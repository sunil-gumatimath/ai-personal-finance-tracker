import { createAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters"

/**
 * Neon Auth client for the frontend.
 * In production on Vercel, `/neon-auth/*` is rewritten to Neon Auth (see `vercel.json`).
 * This keeps auth cookies on the same domain as the app.
 * You can still override with `VITE_NEON_AUTH_URL` if needed.
 */
const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1'

const directNeonAuthUrl = 'https://ep-odd-block-a13wgvy0.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth'
const rewriteAuthUrl =
  `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/neon-auth/auth`

// Base URL precedence: in production always prefer the same-origin rewrite
// path (a stale localhost VITE_NEON_AUTH_URL baked at build time would break
// prod auth). Only honor the env var in prod if it is a non-localhost https URL.
const envAuthUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined
const isLocalhostEnv = !!envAuthUrl && /localhost|127\.0\.0\.1/.test(envAuthUrl)
const authUrl = isProduction
  ? (!envAuthUrl || isLocalhostEnv ? rewriteAuthUrl : envAuthUrl)
  : (envAuthUrl || directNeonAuthUrl)

// If neither is available (extremely unlikely), log a loud error.
if (!authUrl) console.error('❌ Neon Auth URL is missing. Signup/Login will fail.')

export const authClient = createAuthClient(
  authUrl,
  { adapter: BetterAuthReactAdapter() }
)
