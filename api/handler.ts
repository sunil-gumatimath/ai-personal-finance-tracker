import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ApiRequest, ApiResponse } from './utils/types.js'
import { checkRateLimit } from './middleware/rate-limit.js'
import {
  buildResponseHeaders,
  isRateLimitedPath,
  resolveCorsOrigin,
} from './config/server-config.js'
import { resolveRoute } from './routes/index.js'
import { logEvent } from './services/audit-log.service.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url!, `https://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname

  if (!pathname.startsWith('/api/')) {
    res.status(404).json({ error: 'Not Found' })
    return
  }

  const apiPath = pathname.replace(/^\/api\//, '')
  const routeHandler = resolveRoute(apiPath)

  if (!routeHandler) {
    res.status(404).json({ error: `Route ${pathname} not found` })
    return
  }

  // CORS: reject disallowed origins before doing any work
  const origin = (req.headers.origin as string) || ''
  const cors = resolveCorsOrigin(origin)
  if (!cors.ok) {
    res.status(403).json({ error: 'Forbidden - origin not allowed' })
    return
  }

  const headers = buildResponseHeaders(cors.origin)
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (isRateLimitedPath(pathname)) {
    const clientId =
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      'unknown'
    const isAuth = pathname.startsWith('/api/auth')
    const { allowed, retryAfter } = await checkRateLimit(clientId, pathname, isAuth)
    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfter ?? 60))
      res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' })
      return
    }
  }

  let body: Record<string, unknown> = {}
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    body = req.body as Record<string, unknown>
  }

  const apiReq: ApiRequest = {
    method: req.method,
    body,
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.join(', ') : v || '',
      ]),
    ) as ApiRequest['headers'],
    query: Object.fromEntries(
      Object.entries(req.query).map(([k, v]) => [
        k,
        Array.isArray(v) ? v[0] : v || '',
      ]),
    ) as ApiRequest['query'],
  }

  let responseStatus = 200
  const apiRes: ApiResponse = {
    status(code) {
      responseStatus = code
      return this
    },
    json(data) {
      res.status(responseStatus).json(data)
      return this
    },
    setHeader(k, v) {
      res.setHeader(k, Array.isArray(v) ? v.join(', ') : v)
      return this
    },
    end(data) {
      res
        .status(responseStatus)
        .send(typeof data === 'string' ? data : data == null ? '' : String(data))
      return this
    },
  }

  try {
    await routeHandler(apiReq, apiRes)
  } catch (error) {
    console.error(`Error in ${pathname}:`, error)
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

    res.status(500).json({ error: 'Internal Server Error' })
  }
}
