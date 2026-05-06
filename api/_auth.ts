import { createAuthClient } from '@neondatabase/auth'
import { queryOne } from './_db.js'

/**
 * Neon Auth client initialized with the URL from environment variables.
 */
const authUrl =
  process.env.NEON_AUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/neon-auth/auth` : undefined);
if (!authUrl && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ NEON_AUTH_URL is not set in production. Authentication will fail.');
}

export const authClient = createAuthClient(authUrl || '')

export async function getAuthedUserId(req: { headers?: Record<string, string | string[] | undefined> }): Promise<string | null> {
  const incomingHeaders = new Headers()
  if (req.headers?.cookie) incomingHeaders.set('cookie', Array.isArray(req.headers.cookie) ? req.headers.cookie.join(';') : req.headers.cookie)
  if (req.headers?.authorization) incomingHeaders.set('authorization', Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization)
  
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
