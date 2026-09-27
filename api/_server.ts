import './_utils/dns-bypass.js'
import { serve } from 'bun'
import type { ApiRequest, ApiResponse } from './_utils/types.js'
import { checkRateLimit } from './_middleware/rate-limit.js'
import {
  activeWsClients,
  ensureSystemLogsTable,
  logEvent,
} from './_services/audit-log.service.js'
import { getAuthedUserId } from './_services/auth.service.js'
import {
  buildResponseHeaders,
  getClientId,
  isRateLimitedPath,
  MAX_REQUEST_BODY_BYTES,
  MAX_WS_CLIENTS,
  resolveCorsOrigin,
} from './_config/server-config.js'
import { resolveRouteEntry } from './_routes/index.js'

const PORT = process.env.PORT || 3001

console.log(`🚀 API Server starting on http://localhost:${PORT}`)

async function bootstrapSystemLogs() {
  try {
    // Canonical DDL lives in audit-log.service.ts; the dev server just makes
    // sure the table exists at boot so early logs are not lost.
    await ensureSystemLogsTable()

    await logEvent(null, {
      action: 'DEPLOYMENT_EVENT',
      resource: 'system/server',
      newValue: 'System server booted successfully.',
      severity: 'info',
      status: 'success',
      metadata: { port: PORT, env: process.env.NODE_ENV || 'development' },
    })
  } catch (error) {
    console.error('❌ Failed to ensure system_logs table:', error)
  }
}

bootstrapSystemLogs()

try {
  serve({
    port: PORT,
    async fetch(req, server) {
      const url = new URL(req.url)
      const pathname = url.pathname

      // Upgrade WebSocket connections for /api/ws-logs
      if (pathname === '/api/ws-logs') {
        const origin = req.headers.get('origin') || ''
        const cors = resolveCorsOrigin(origin)
        if (!cors.ok) {
          return new Response('Forbidden - origin not allowed', { status: 403 })
        }

        const userId = await getAuthedUserId({
          method: req.method,
          headers: Object.fromEntries(req.headers.entries()),
        })
        if (!userId) {
          return new Response('Unauthorized', { status: 401 })
        }

        // Cap concurrent log-feed sockets. `activeWsClients` is an uncapped
        // Set, and the upgrade path was unrate-limited, so one authenticated
        // user could open unbounded connections and grow the process heap.
        // Memory-only (per-client filtering already prevents data leakage), but
        // it is a trivial DoS. DEV-ONLY endpoint: `isLiveFeedSupported()` in
        // useSystemLogs.ts restricts the client to localhost, and Vercel
        // serverless has no long-lived socket support at all.
        if (activeWsClients.size >= MAX_WS_CLIENTS) {
          return new Response('Too many connections', { status: 503 })
        }

        if (server.upgrade(req, { data: { userId } } as any)) return // upgrade successful
        return new Response('WebSocket upgrade failed', { status: 400 })
      }

      if (!pathname.startsWith('/api/')) {
        return new Response('Not Found', { status: 404 })
      }

      const apiPath = pathname.replace(/^\/api\//, '')

      // Security: block path traversal attempts
      if (apiPath.includes('..') || apiPath.includes('\0') || apiPath.includes('\\')) {
        return new Response(JSON.stringify({ error: 'Invalid path' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...buildResponseHeaders('') },
        })
      }

      const headers = new Headers({
        'Content-Type': 'application/json',
      })

      // CORS check (reject disallowed origins)
      const origin = req.headers.get('origin') || ''
      const cors = resolveCorsOrigin(origin)
      if (!cors.ok) {
        return new Response(JSON.stringify({ error: 'Forbidden - origin not allowed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...buildResponseHeaders('') },
        })
      }

      const fullHeaders = buildResponseHeaders(cors.origin)
      for (const [k, v] of Object.entries(fullHeaders)) headers.set(k, v)

      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers })
      }

      // Resolve route through the shared registry (matches Vercel routing).
      // We need the canonical key, not just the handler: the lookup walks up
      // path segments, so several raw paths map to one route and the rate
      // limiter must bucket them together.
      const route = resolveRouteEntry(apiPath)

      if (!route) {
        console.log(`❌ 404: ${pathname}`)
        return new Response(JSON.stringify({ error: `Route ${pathname} not found` }), {
          status: 404,
          headers,
        })
      }
      const handler = route.handler

      // Rate limiting for sensitive endpoints. Auth routes do their own
      // stricter limiting inside auth.routes.ts, so isAuthEndpoint stays off.
      //
      // Keyed on `/api/${route.key}`, NOT `pathname`. Keying on the raw path
      // meant `/api/ai/chat`, `/api/ai/chat/a`, `/api/ai/chat/1`, ... each got
      // their own independent 20-request budget against the same handler —
      // an unbounded multiplier on the routes that cost an LLM call per hit.
      const canonicalPath = `/api/${route.key}`
      if (isRateLimitedPath(canonicalPath)) {
        const { allowed, retryAfter } = await checkRateLimit(
          getClientId(req),
          canonicalPath,
        )
        if (!allowed) {
          headers.set('Retry-After', String(retryAfter ?? 60))
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers },
          )
        }
      }

      // Reject an oversized body BEFORE parsing it.
      //
      // `req.json()` below fully buffers and parses the request, and it runs
      // before any handler, therefore before `getAuthedUserId`. Combined with
      // a client-controlled client id, that let an unauthenticated caller
      // POST a multi-hundred-megabyte body repeatedly and OOM the process.
      // Checking Content-Length up front makes the cheap rejection happen
      // first; the streaming cap below covers a lying or absent header.
      const declaredLength = Number(req.headers.get('content-length') ?? '0')
      if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
        return new Response(
          JSON.stringify({ error: 'Request body too large' }),
          { status: 413, headers },
        )
      }

      // Parse body
      let body: Record<string, unknown> = {}
      try {
        if (req.method !== 'GET' && req.method !== 'OPTIONS') body = await req.json()
      } catch {
        // empty / non-JSON body is fine
      }

      const mockReq: ApiRequest = {
        method: req.method,
        body,
        signal: req.signal,
        headers: Object.fromEntries(req.headers.entries()),
        query: Object.fromEntries(url.searchParams.entries()),
      }

      let status = 200
      let responseBody: string | null = null

      // Chunked-streaming support: a route calls startChunkedStream to switch
      // its response into progressive mode (used by AI chat). The Response is
      // handed back to Bun as soon as that happens, so chunks reach the client
      // while the handler is still running.
      let streamReadable: ReadableStream<Uint8Array> | null = null
      let streamController: ReadableStreamDefaultController<Uint8Array> | null =
        null
      let streamStarted = false
      let notifyStreamStarted: () => void = () => {}
      const streamStartedPromise = new Promise<void>((resolve) => {
        notifyStreamStarted = resolve
      })
      const encoder = new TextEncoder()
      const enqueueLine = (line: string) => {
        try {
          streamController?.enqueue(encoder.encode(line))
        } catch {
          // stream already closed — nothing to do
        }
      }

      const mockRes: ApiResponse = {
        status(s: number) {
          status = s
          return this
        },
        json(data: unknown) {
          responseBody = JSON.stringify(data)
          return this
        },
        setHeader(k: string, v: string | string[]) {
          headers.set(k, Array.isArray(v) ? v.join(', ') : v)
          return this
        },
        end(data?: unknown) {
          responseBody = typeof data === 'string' ? data : data == null ? null : String(data)
          return this
        },
        startChunkedStream(contentType: string) {
          if (streamStarted) return null
          streamStarted = true
          headers.set('Content-Type', contentType)
          headers.set('Cache-Control', 'no-cache, no-transform')
          headers.set('X-Accel-Buffering', 'no')
          streamReadable = new ReadableStream<Uint8Array>({
            start(c) {
              streamController = c
            },
          })
          notifyStreamStarted()
          return {
            write(chunk: string) {
              enqueueLine(chunk)
            },
            close() {
              try {
                streamController?.close()
              } catch {
                // already closed
              }
            },
          }
        },
      }

      try {
        console.log(`✨ ${req.method} ${pathname}`)
        const handled = handler(mockReq, mockRes)

        const settled = await Promise.race([
          handled.then(
            () => 'done' as const,
            (error: unknown) => ({ error }),
          ),
          streamStartedPromise.then(() => 'stream' as const),
        ])

        if (settled === 'stream') {
          // Streaming response: keep the handler running in the background and
          // close the stream once it settles (or surface a final error event).
          void handled
            .catch((streamError: unknown) => {
              console.error(`💥 Error in ${pathname}:`, streamError)
              logEvent(null, {
                action: 'ERROR',
                resource: pathname,
                newValue:
                  streamError instanceof Error
                    ? streamError.message
                    : String(streamError),
                severity: 'critical',
                status: 'failure',
              }).catch(() => {})
              enqueueLine(
                `${JSON.stringify({ type: 'error', message: 'Internal Server Error' })}\n`,
              )
            })
            .finally(() => {
              try {
                streamController?.close()
              } catch {
                // already closed
              }
            })
          console.log(`🌊 Streaming response started`)
          return new Response(streamReadable, { status: 200, headers })
        }

        if (settled !== 'done') throw (settled as { error: unknown }).error

        console.log(`✅ Handler finished`)
        return new Response(responseBody, { status, headers })
      } catch (error: unknown) {
        console.error(`💥 Error in ${pathname}:`, error)
        logEvent(null, {
          action: 'ERROR',
          resource: pathname,
          newValue: error instanceof Error ? error.message : String(error),
          severity: 'critical',
          status: 'failure',
          metadata: {
            stack: error instanceof Error ? error.stack : undefined,
            method: req.method,
          },
        }).catch((err) => console.error('Failed to log server exception:', err))

        // Never leak internal error details to the client
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 500,
          headers,
        })
      }
    },
    websocket: {
      open(ws) {
        console.log('🔌 Live logs WebSocket connection opened')
        activeWsClients.add(ws)
      },
      message() {
        // no-op
      },
      close(ws) {
        console.log('🔌 Live logs WebSocket connection closed')
        activeWsClients.delete(ws)
      },
    },
  })
} catch (error: any) {
  if (error.code === 'EADDRINUSE' || (error.message && error.message.includes('EADDRINUSE'))) {
    console.error(`\n❌ Failed to start API server: Port ${PORT} is already in use!`)
    console.error(`💡 Tips to resolve this:`)
    if (process.platform === 'win32') {
      console.error(`   Run the following command in PowerShell to free port ${PORT}:`)
      console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`)
    } else {
      console.error(`   Run the following command in Terminal to free port ${PORT}:`)
      console.error(`   kill -9 $(lsof -t -i:${PORT})`)
    }
    console.error()
    process.exit(1)
  } else {
    throw error
  }
}
