import { createAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters"

/**
 * Neon Auth client for the frontend.
 * The VITE_NEON_AUTH_URL should be set in your .env file.
 */
export const authClient = createAuthClient(
  import.meta.env.VITE_NEON_AUTH_URL || "",
  { adapter: BetterAuthReactAdapter() }
)
