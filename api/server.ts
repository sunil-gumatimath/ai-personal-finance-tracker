import './utils/dns-bypass.js'
import { serve } from 'bun'
import path from 'path'
import type { ApiRequest, ApiResponse } from './utils/types.js'
import { checkRateLimit } from './middleware/rate-limit.js'
import { logEvent, activeWsClients } from './services/audit-log.service.js'
import { getAuthedUserId } from './services/auth.service.js'
import {
  buildResponseHeaders,
  isRateLimitedPath,
  resolveCorsOrigin,
} from './config/server-config.js'
import { resolveRoute } from './routes/index.js'

const PORT = process.env.PORT || 3001

console.log(`🚀 API Server starting on http://localhost:${PORT}`)

async function ensureSystemLogsTable() {
  try {
    // Best-effort: only relevant when a database is configured.
    const { query } = await import('./repositories/db.js')
    await query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email TEXT,
        severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
        status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure')),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);`)
    await query(`CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);`)
    await query(`CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity);`)
    console.log('✅ Database system_logs table and indexes verified.')

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

ensureSystemLogsTable()

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

      // Resolve route. Bun dev supports both file-based (handlers/<path>.ts)
      // and the shared registry. File-based takes precedence so individual
      // handler modules can be hot-reloaded during development.
      let handler: ((req: ApiRequest, res: ApiResponse) => Promise<unknown>) | null = null
      const extraParams: Record<string, string> = {}

      // 1. Exact file: api/routes/<path>.ts
      const exactPath = path.join(process.cwd(), 'api', 'routes', apiPath + '.ts')
      if (await Bun.file(exactPath).exists()) {
        const mod = await import(exactPath)
        if (typeof mod.default === 'function') handler = mod.default
      }

      // 2. Index file: api/routes/<path>/index.ts
      if (!handler) {
        const indexPath = path.join(process.cwd(), 'api', 'routes', apiPath, 'index.ts')
        if (await Bun.file(indexPath).exists()) {
          const mod = await import(indexPath)
          if (typeof mod.default === 'function') handler = mod.default
        }
      }

      // 3. Dynamic [id].ts
      if (!handler) {
        const parts = apiPath.split('/')
        if (parts.length > 0) {
          const lastPart = parts.pop()
          const parentPath = parts.join('/')
          const dynamicPath = path.join(
            process.cwd(),
            'api',
            'routes',
            parentPath,
            '[id].ts',
          )
          if (await Bun.file(dynamicPath).exists()) {
            const mod = await import(dynamicPath)
            if (typeof mod.default === 'function') handler = mod.default
            if (lastPart) extraParams.id = lastPart
          }
        }
      }

      // 4. Fall back to the shared registry (matches Vercel routing)
      if (!handler) handler = resolveRoute(apiPath)

      if (!handler) {
        console.log(`❌ 404: ${pathname}`)
        return new Response(JSON.stringify({ error: `Route ${pathname} not found` }), {
          status: 404,
          headers,
        })
      }

      // Rate limiting for sensitive endpoints
      if (isRateLimitedPath(pathname)) {
        const clientId =
          req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
        const isAuth = pathname.startsWith('/api/auth')
        const { allowed, retryAfter } = await checkRateLimit(clientId, pathname, isAuth)
        if (!allowed) {
          headers.set('Retry-After', String(retryAfter ?? 60))
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers },
          )
        }
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
        headers: Object.fromEntries(req.headers.entries()),
        query: { ...Object.fromEntries(url.searchParams.entries()), ...extraParams },
      }

      let status = 200
      let responseBody: string | null = null
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
      }

      try {
        console.log(`✨ ${req.method} ${pathname}`)
        await handler(mockReq, mockRes)
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
