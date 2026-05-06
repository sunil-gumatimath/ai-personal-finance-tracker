import { createAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters"

/**
 * Neon Auth client for the frontend.
 * In production on Vercel, `/neon-auth/*` is rewritten to Neon Auth (see `vercel.json`).
 * You can still override with `VITE_NEON_AUTH_URL` if needed.
 */
/**
 * IMPORTANT:
 * In some deployments, relying on a reverse-proxy rewrite for Auth can break cookie/session behavior.
 * Since `vercel.json` already hardcodes the Neon Auth origin, we use the same origin as a production fallback.
 */
const VERCEL_NEON_AUTH_ORIGIN_FALLBACK =
  'https://ep-odd-block-a13wgvy0.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth'

const rewriteAuthUrl =
  `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/neon-auth/auth`

const authUrl =
  import.meta.env.VITE_NEON_AUTH_URL || rewriteAuthUrl

// If neither is available (extremely unlikely), log a loud error.
if (!authUrl) console.error('❌ Neon Auth URL is missing. Signup/Login will fail.');

export const authClient = createAuthClient(
  authUrl,
  { adapter: BetterAuthReactAdapter() }
)
