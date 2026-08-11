import { createAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters"

/**
 * Neon Auth client for the frontend.
 * In production on Vercel, `/neon-auth/*` is rewritten to Neon Auth (see `vercel.json`).
 * This keeps auth cookies on the same domain as the app.
 * You can still override with `VITE_NEON_AUTH_URL` if needed.
 */
const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost')

const directNeonAuthUrl = 'https://ep-odd-block-a13wgvy0.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth'
const rewriteAuthUrl =
  `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/neon-auth/auth`

// Use direct URL in local development if VITE_NEON_AUTH_URL is not set
// Use rewrite URL in production for cookie domain alignment
const authUrl = import.meta.env.VITE_NEON_AUTH_URL ||
  (isProduction ? rewriteAuthUrl : directNeonAuthUrl)

// If neither is available (extremely unlikely), log a loud error.
if (!authUrl) console.error('❌ Neon Auth URL is missing. Signup/Login will fail.');

console.log('Frontend auth URL:', authUrl, 'Is production:', isProduction)

export const authClient = createAuthClient(
  authUrl,
  { adapter: BetterAuthReactAdapter() }
)
