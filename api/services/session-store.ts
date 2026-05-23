import { createHash } from 'crypto'

const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-do-not-use-in-production'

/**
 * In-memory session store as fallback when Neon Auth's session API is unavailable.
 * Maps token_hash → user_id. Entries survive only for the lifetime of the server process.
 */
const sessions = new Map<string, string>()

function hashToken(token: string): string {
  return createHash('sha256')
    .update(`${AUTH_SECRET}:${token}`)
    .digest('hex')
}

export function storeSession(token: string, userId: string): void {
  sessions.set(hashToken(token), userId)
}

export function getUserIdFromToken(token: string): string | undefined {
  return sessions.get(hashToken(token))
}

export function removeSession(token: string): void {
  sessions.delete(hashToken(token))
}
