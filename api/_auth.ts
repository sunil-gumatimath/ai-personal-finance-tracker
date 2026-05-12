import { createAuthClient } from '@neondatabase/auth'
import { queryOne } from './_db.js'
import { getUserIdFromToken, storeSession } from './_session-store.js'

/**
 * Neon Auth client initialized with the URL from environment variables.
 */
const VERCEL_NEON_AUTH_ORIGIN_FALLBACK =
  'https://ep-odd-block-a13wgvy0.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth'

function normalizeNeonAuthUrl(url: string): string {
  // Older setup instructions used the Neon Data API host. Neon Auth must use
  // the neonauth host, otherwise login returns "missing authentication credentials".
  return url
    .replace('.apirest.', '.neonauth.')
    .replace('/neondb/rest/v1/auth', '/neondb/auth')
    .replace('/neondb/rest/v1', '/neondb/auth')
}

const authUrl = normalizeNeonAuthUrl(
  process.env.NEON_AUTH_URL || VERCEL_NEON_AUTH_ORIGIN_FALLBACK,
)

if (!authUrl && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ NEON_AUTH_URL is not set in production. Authentication will fail.');
}

console.log('🔐 Neon Auth URL:', authUrl)
console.log('🔐 NEON_AUTH_URL env var:', process.env.NEON_AUTH_URL ? 'SET' : 'NOT SET')

export const authClient = createAuthClient(authUrl || '')

// Extract the origin (scheme + host) from the auth URL or request headers
export function getAuthOrigin(req?: { headers?: Record<string, string | string[] | undefined> }): string {
  // First priority: use the App's origin from headers if available
  if (req?.headers) {
    const host = req.headers['host']
    const proto = req.headers['x-forwarded-proto'] || 'https'
    if (host) {
      const origin = `${proto}://${host}`
      console.log('🔐 Auth Origin (from request):', origin)
      return origin
    }
  }

  // Second priority: use the configured App URL
  if (process.env.VITE_APP_URL) {
    console.log('🔐 Auth Origin (from env):', process.env.VITE_APP_URL)
    return process.env.VITE_APP_URL
  }

  // Fallback: extract from the auth URL (likely the Neon domain, which might be rejected)
  try {
    const url = new URL(authUrl)
    const origin = `${url.protocol}//${url.host}`
    console.log('🔐 Auth Origin (fallback to authUrl):', origin)
    return origin
  } catch {
    console.log('🔐 Auth Origin: ABSOLUTE FALLBACK')
    return 'https://ep-odd-block-a13wgvy0.neonauth.ap-southeast-1.aws.neon.tech'
  }
}

export function getAuthUrlDiagnostics() {
  try {
    const url = new URL(authUrl)
    return {
      host: url.host,
      path: url.pathname,
      source: process.env.NEON_AUTH_URL ? 'NEON_AUTH_URL' : 'fallback',
    }
  } catch {
    return {
      host: 'invalid',
      path: 'invalid',
      source: process.env.NEON_AUTH_URL ? 'NEON_AUTH_URL' : 'fallback',
    }
  }
}

export async function getAuthedUserId(req: { headers?: Record<string, string | string[] | undefined> }): Promise<string | null> {
  // Get the auth token from the Authorization header
  const authHeader = req.headers?.authorization
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null

  // First try: local session store (fast, works when Neon Auth session API is down)
  if (token) {
    const localUserId = getUserIdFromToken(token)
    if (localUserId) {
      return localUserId
    }
  }

  // Second try: Neon Auth session API (may fail if session endpoint is unavailable)
  const incomingHeaders = new Headers()
  if (req.headers?.cookie) incomingHeaders.set('cookie', Array.isArray(req.headers.cookie) ? req.headers.cookie.join(';') : req.headers.cookie)
  if (req.headers?.authorization) incomingHeaders.set('authorization', Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization)
  incomingHeaders.set('Origin', getAuthOrigin(req))

  try {
    const result = await authClient.getSession({
      fetchOptions: { headers: incomingHeaders }
    })
    if (result.data?.user?.id) {
      if (token) storeSession(token, result.data.user.id)
      return result.data.user.id
    }
  } catch (err) {
    console.error('[getAuthedUserId] getSession threw:', err)
  }

  return null
}

export type AuthedUser = {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  created_at: string
}

export async function getAuthedUser(req: { headers?: Record<string, string | string[] | undefined> }): Promise<AuthedUser | null> {
  const userId = await getAuthedUserId(req)
  if (!userId) return null
  
  // Neon Auth user info might be available in the session directly, 
  // but for full profile data we still query the users table.
  return queryOne<AuthedUser>(
    'SELECT id, email, full_name, avatar_url, created_at FROM users WHERE id = $1',
    [userId],
  )
}
