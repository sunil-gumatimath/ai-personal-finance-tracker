/**
 * Centralized access to build-time environment variables and derived flags.
 *
 * Always read `import.meta.env.VITE_*` through this module so there is a
 * single audited place for runtime configuration and a clear error when a
 * required variable is missing.
 */

type ImportMetaEnv = {
  readonly VITE_NEON_AUTH_URL?: string
  readonly VITE_APP_URL?: string
  readonly DEV?: boolean
  readonly PROD?: boolean
  readonly MODE?: string
}

const env = (import.meta.env ?? {}) as ImportMetaEnv

export const isProd = Boolean(env.PROD)
export const isDev = Boolean(env.DEV)
export const mode = env.MODE ?? 'development'

/** Explicit Neon Auth override (optional). Falls back to runtime detection. */
export const NEON_AUTH_URL: string | undefined = env.VITE_NEON_AUTH_URL

/** Optional app URL override (used by some handlers). */
export const APP_URL: string | undefined = env.VITE_APP_URL

/**
 * Returns true if the current runtime is a browser on localhost.
 * Used to choose between direct Neon Auth and the same-origin rewrite.
 */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1'
}

/** Throws when a required env var is missing — fail fast at boot. */
export function requireEnv(name: keyof ImportMetaEnv): string {
  const value = env[name]
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing required environment variable: ${String(name)}`)
  }
  return value
}
