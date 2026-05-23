/**
 * Simple in-memory rate limiter for API endpoints
 * NOTE: In a production multi-instance deployment, use Redis or a database-backed rate limiter
 */

interface RateLimitEntry {
  count: number
  resetTime: number
  blocked: boolean
  blockExpiry: number
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 60 * 1000 // 1 minute window
const MAX_REQUESTS = 20 // max requests per window for general endpoints
const AUTH_MAX_REQUESTS = 5 // stricter for auth endpoints
const BLOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes block

function getKey(identifier: string, endpoint: string): string {
  return `${identifier}:${endpoint}`
}

function getEntry(key: string): RateLimitEntry {
  const now = Date.now()
  const existing = store.get(key)
  if (!existing || now > existing.resetTime) {
    return { count: 0, resetTime: now + WINDOW_MS, blocked: false, blockExpiry: 0 }
  }
  return existing
}

function cleanup(): void {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (!entry.blocked && now > entry.resetTime) {
      store.delete(key)
    }
  }
}

// Periodic cleanup every 10 minutes
setInterval(cleanup, 10 * 60 * 1000)

export function checkRateLimit(
  identifier: string,
  endpoint: string,
  isAuthEndpoint = false,
): { allowed: boolean; retryAfter?: number } {
  const key = getKey(identifier, endpoint)
  const entry = getEntry(key)
  const maxRequests = isAuthEndpoint ? AUTH_MAX_REQUESTS : MAX_REQUESTS

  if (entry.blocked && Date.now() < entry.blockExpiry) {
    return { allowed: false, retryAfter: Math.ceil((entry.blockExpiry - Date.now()) / 1000) }
  }

  if (entry.blocked && Date.now() >= entry.blockExpiry) {
    entry.blocked = false
    entry.count = 0
    entry.resetTime = Date.now() + WINDOW_MS
  }

  entry.count++
  store.set(key, entry)

  if (entry.count > maxRequests) {
    entry.blocked = true
    entry.blockExpiry = Date.now() + BLOCK_DURATION_MS
    store.set(key, entry)
    return { allowed: false, retryAfter: BLOCK_DURATION_MS / 1000 }
  }

  return { allowed: true }
}

export function recordFailedAttempt(
  identifier: string,
  endpoint: string,
): { blocked: boolean; retryAfter?: number } {
  const key = getKey(identifier, endpoint)
  const entry = getEntry(key)
  entry.count += 3 // Weight failed attempts more heavily
  store.set(key, entry)

  const maxRequests = AUTH_MAX_REQUESTS
  if (entry.count > maxRequests) {
    entry.blocked = true
    entry.blockExpiry = Date.now() + BLOCK_DURATION_MS
    store.set(key, entry)
    return { blocked: true, retryAfter: BLOCK_DURATION_MS / 1000 }
  }

  return { blocked: false }
}
