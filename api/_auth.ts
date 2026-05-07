import { createAuthClient } from '@neondatabase/auth'
import { queryOne } from './_db.js'

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

export const authClient = createAuthClient(authUrl || '')

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
  const incomingHeaders = new Headers()
  if (req.headers?.cookie) incomingHeaders.set('cookie', Array.isArray(req.headers.cookie) ? req.headers.cookie.join(';') : req.headers.cookie)
  if (req.headers?.authorization) incomingHeaders.set('authorization', Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization)

  // Set proper Origin header for Neon Auth CORS
  const appOrigin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:5173'
  incomingHeaders.set('Origin', appOrigin)

  const { data } = await authClient.getSession({
    fetchOptions: {
      headers: incomingHeaders
    }
  })
  return data?.user.id || null
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
