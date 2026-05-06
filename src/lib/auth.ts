import { createAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters"

/**
 * Neon Auth client for the frontend.
 * In production on Vercel, `/neon-auth/*` is rewritten to Neon Auth (see `vercel.json`).
 * You can still override with `VITE_NEON_AUTH_URL` if needed.
 */
const defaultAuthUrl =
  `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/neon-auth/auth`

const authUrl = import.meta.env.VITE_NEON_AUTH_URL || defaultAuthUrl;

// If neither is available (extremely unlikely), log a loud error.
if (!authUrl) console.error('❌ Neon Auth URL is missing. Signup/Login will fail.');

export const authClient = createAuthClient(
  authUrl,
  { adapter: BetterAuthReactAdapter() }
)
