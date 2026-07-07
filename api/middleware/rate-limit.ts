import { createHash } from "crypto";
import { queryOne } from "../repositories/db.js";

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

function getLocalKey(identifier: string, endpoint: string): string {
  return `${identifier}:${endpoint}`
}

function getDbKey(identifier: string, endpoint: string): string {
  return createHash("sha256").update(`${identifier}:${endpoint}`).digest("hex")
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

function checkLocalRateLimit(
  identifier: string,
  endpoint: string,
  isAuthEndpoint = false,
  weight = 1,
): { allowed: boolean; retryAfter?: number } {
  const key = getLocalKey(identifier, endpoint)
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

  entry.count += weight
  store.set(key, entry)

  if (entry.count > maxRequests) {
    entry.blocked = true
    entry.blockExpiry = Date.now() + BLOCK_DURATION_MS
    store.set(key, entry)
    return { allowed: false, retryAfter: BLOCK_DURATION_MS / 1000 }
  }

  return { allowed: true }
}

async function consumeDbRateLimit(
  identifier: string,
  endpoint: string,
  maxRequests: number,
  weight: number,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = getDbKey(identifier, endpoint)
  const row = await queryOne<{ count: string | number; blocked_until: string | null }>(
    `
    INSERT INTO rate_limits (key, count, window_start, blocked_until, updated_at)
    VALUES ($1, $2::int, NOW(), CASE WHEN $2::int > $3::int THEN NOW() + ($5::int::text || ' milliseconds')::interval ELSE NULL END, NOW())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.blocked_until IS NOT NULL AND rate_limits.blocked_until > NOW() THEN rate_limits.count
        WHEN rate_limits.window_start < NOW() - ($4::int::text || ' milliseconds')::interval THEN $2::int
        ELSE rate_limits.count + $2::int
      END,
      window_start = CASE
        WHEN rate_limits.blocked_until IS NOT NULL AND rate_limits.blocked_until > NOW() THEN rate_limits.window_start
        WHEN rate_limits.window_start < NOW() - ($4::int::text || ' milliseconds')::interval THEN NOW()
        ELSE rate_limits.window_start
      END,
      blocked_until = CASE
        WHEN rate_limits.blocked_until IS NOT NULL AND rate_limits.blocked_until > NOW() THEN rate_limits.blocked_until
        WHEN rate_limits.window_start < NOW() - ($4::int::text || ' milliseconds')::interval THEN NULL
        WHEN rate_limits.count + $2::int > $3::int THEN NOW() + ($5::int::text || ' milliseconds')::interval
        ELSE NULL
      END,
      updated_at = NOW()
    RETURNING count, blocked_until
    `,
    [key, weight, maxRequests, WINDOW_MS, BLOCK_DURATION_MS],
  )

  const blockedUntil = row?.blocked_until ? new Date(row.blocked_until).getTime() : 0
  if (blockedUntil > Date.now()) {
    return {
      allowed: false,
      retryAfter: Math.ceil((blockedUntil - Date.now()) / 1000),
    }
  }

  return { allowed: true }
}

export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  isAuthEndpoint = false,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const maxRequests = isAuthEndpoint ? AUTH_MAX_REQUESTS : MAX_REQUESTS

  if (process.env.USE_MOCK_DB === 'true' || !process.env.NEON_DATABASE_URL) {
    return checkLocalRateLimit(identifier, endpoint, isAuthEndpoint)
  }

  try {
    return await consumeDbRateLimit(identifier, endpoint, maxRequests, 1)
  } catch (error) {
    console.warn("Database rate limiter unavailable, using local fallback:", error instanceof Error ? error.message : String(error))
    return checkLocalRateLimit(identifier, endpoint, isAuthEndpoint)
  }
}

export async function recordFailedAttempt(
  identifier: string,
  endpoint: string,
): Promise<{ blocked: boolean; retryAfter?: number }> {
  if (process.env.USE_MOCK_DB !== 'true' && process.env.NEON_DATABASE_URL) {
    try {
      const result = await consumeDbRateLimit(identifier, endpoint, AUTH_MAX_REQUESTS, 3)
      return { blocked: !result.allowed, retryAfter: result.retryAfter }
    } catch (error) {
      console.warn("Database rate limiter unavailable, using local fallback:", error instanceof Error ? error.message : String(error))
    }
  }

  const result = checkLocalRateLimit(identifier, endpoint, true, 3)
  return { blocked: !result.allowed, retryAfter: result.retryAfter }
}
