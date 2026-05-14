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
    // Note: req.headers keys are lowercase in Node/Bun
    const host = req.headers['host']
    const proto = req.headers['x-forwarded-proto'] || 'https'
    
    if (host && typeof host === 'string') {
      const cleanHost = host.trim().replace(/\/$/, '').toLowerCase()
      
      // Local development check: always use the frontend port 5173
      if (cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1')) {
        const origin = 'http://localhost:5173'
        console.log('🔐 Auth Origin (Local Dev Override):', origin)
        return origin
      }
      
      const origin = `${proto}://${cleanHost}`
      console.log('🔐 Auth Origin (from request):', origin)
      return origin
    }
  }

  // Second priority: use the configured App URL
  if (process.env.VITE_APP_URL) {
    const origin = process.env.VITE_APP_URL.trim().replace(/\/$/, '')
    console.log('🔐 Auth Origin (from env):', origin)
    return origin
  }

  // Production Fallback (Explicitly trust the Vercel domain)
  if (process.env.NODE_ENV === 'production') {
    return 'https://personal-finance-tracker-ted.vercel.app'
  }

  // Final Fallback: extract from the auth URL
  try {
    const url = new URL(authUrl)
    const origin = `${url.protocol}//${url.host}`
    console.log('🔐 Auth Origin (fallback to authUrl):', origin)
    return origin
  } catch {
    console.log('🔐 Auth Origin: ABSOLUTE FALLBACK')
    return 'https://personal-finance-tracker-ted.vercel.app'
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

export async function getAuthedUserId(req: { method?: string; headers: Record<string, string | string[] | undefined> }): Promise<string | null> {
  console.log('🔍 getAuthedUserId - Method:', req.method, 'Headers:', JSON.stringify({
    authorization: req.headers['authorization'] ? 'Present' : 'Missing',
    cookie: req.headers['cookie'] ? 'Present' : 'Missing'
  }));

  // Try Authorization header first
  const authHeader = req.headers['authorization'] as string | undefined
  let token = ''
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
    console.log('🎫 Found Bearer token');
  }

  // If no auth header, try cookies (standard for Neon Auth / better-auth)
  if (!token) {
    const cookieHeader = req.headers['cookie'] as string | undefined
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, c: string) => {
        const [k, v] = c.trim().split('=')
        acc[k] = v
        return acc
      }, {})
      
      token = cookies['better-auth.session_token'] || cookies['session_token']
      if (token) console.log('🍪 Found token in cookies');
    }
  }

  // First try: local session store (fast, works when Neon Auth session API is down)
  if (token) {
    const localUserId = getUserIdFromToken(token)
    if (localUserId) {
      console.log('✅ Found userId in local session store:', localUserId);
      return localUserId
    } else {
      console.log('❓ Token not found in local session store');
    }
  } else {
    console.log('❌ No token found in headers or cookies');
  }

  // Second try: Verify with Neon Auth server
  try {
    const origin = getAuthOrigin(req)
    console.log('🌐 Using origin for verification:', origin);
    
    // Pass the incoming headers to the auth client
    const incomingHeaders: Record<string, string> = {}
    if (origin) incomingHeaders['Origin'] = origin
    if (authHeader) incomingHeaders['Authorization'] = authHeader
    if (req.headers['cookie']) {
      const cookie = req.headers['cookie']
      incomingHeaders['Cookie'] = Array.isArray(cookie) ? cookie.join('; ') : cookie
    }

    const { data, error } = await authClient.getSession({
      fetchOptions: {
        headers: incomingHeaders
      }
    })

    if (data?.user?.id) {
      const userId = data.user.id
      console.log('✅ Verified session with Neon Auth:', userId);
      // Store in local cache for next time
      if (token) {
        storeSession(token, userId)
      }
      return userId
    } else if (error) {
      console.error('❌ Neon Auth session error:', error)
    } else {
      console.log('❌ No user found in Neon Auth session result');
    }
  } catch (error) {
    console.error('💥 Neon Auth verification CRITICAL error:', error)
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
