import { createAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters"

/**
 * Neon Auth client for the frontend.
 * The VITE_NEON_AUTH_URL should be set in your .env file.
 */
const authUrl = import.meta.env.DEV ? `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/neon-auth/auth` : (import.meta.env.VITE_NEON_AUTH_URL || "");

export const authClient = createAuthClient(
  authUrl,
  { adapter: BetterAuthReactAdapter() }
)
