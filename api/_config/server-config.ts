/**
 * Shared server config and types used by both the local Bun dev server
 * (`api/server.ts`) and the Vercel entry point (`api/handler.ts`).
 *
 * Keeping this in one place prevents CORS / security-header / rate-limit
 * logic from drifting between the two runtimes.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

const HSTS_HEADER: Record<string, string> =
  process.env.NODE_ENV === "production"
    ? {
        "Strict-Transport-Security":
          "max-age=63072000; includeSubDomains; preload",
      }
    : {};

/**
 * Origins permitted to make credentialed cross-origin requests.
 *
 * Built from:
 *  - local dev origins (always)
 *  - the known production URL(s)
 *  - Vercel's automatic domain env vars (per-deployment / per-project), so
 *    preview deployments and URL changes keep working without code edits
 *  - an optional comma-separated ALLOWED_ORIGINS env var for custom domains
 */
const LOCAL_ORIGINS = ["http://localhost:5173", "http://localhost:3000"];

const KNOWN_PRODUCTION_ORIGINS = [
  "https://personal-finance-tracker-six-zeta.vercel.app",
];

function computeAllowedOrigins(): Set<string> {
  const origins = new Set<string>([...LOCAL_ORIGINS, ...KNOWN_PRODUCTION_ORIGINS]);

  // Extra origins configured via env (comma-separated list).
  if (process.env.ALLOWED_ORIGINS) {
    for (const entry of process.env.ALLOWED_ORIGINS.split(",")) {
      const trimmed = entry.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  // Vercel injects bare hostnames (no scheme) for each project/deployment.
  for (const key of [
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_BRANCH_URL",
    "VERCEL_URL",
  ]) {
    const host = process.env[key];
    if (host) origins.add(`https://${host}`);
  }

  return origins;
}

const ALLOWED_ORIGINS = computeAllowedOrigins();

/** Origin echoed back when a request arrives without one (curl, cron, etc.). */
const FALLBACK_ORIGIN = LOCAL_ORIGINS[0];

/** Endpoints with stricter rate limits. Auth routes are limited inside auth.ts. */
const RATE_LIMITED_PREFIXES = [
  "/api/ai/chat",
  "/api/ai/insights",
  "/api/ai/digest",
  "/api/ai/parse-transaction",
];

/**
 * Ordered list of preferred origins, used wherever a server-side default
 * Origin is needed (e.g. Neon Auth calls):
 *   1. ALLOWED_ORIGINS env var (comma-separated)
 *   2. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL (Vercel injects bare hosts)
 *   3. localhost dev fallback
 */
export function resolveAllowedOrigins(): string[] {
  const origins: string[] = [];

  if (process.env.ALLOWED_ORIGINS) {
    for (const entry of process.env.ALLOWED_ORIGINS.split(",")) {
      const trimmed = entry.trim().replace(/\/$/, "");
      if (trimmed) origins.push(trimmed);
    }
  }

  for (const key of [
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
  ]) {
    const host = process.env[key];
    if (host) origins.push(`https://${host.trim().replace(/\/$/, "")}`);
  }

  origins.push(LOCAL_ORIGINS[0]);
  return origins;
}

/** First-choice origin when a request does not provide one. */
export function getAuthOriginFallback(): string {
  return resolveAllowedOrigins()[0];
}

/**
 * Fallback currency used when a profile has none set. Kept in one place so
 * the AI routes never disagree about formatting defaults.
 */
export const DEFAULT_CURRENCY = "INR";

/** Resolve an allowed CORS origin or reject the request. */
export function resolveCorsOrigin(
  origin: string,
): { ok: true; origin: string } | { ok: false } {
  if (!origin) return { ok: true, origin: FALLBACK_ORIGIN };
  if (!ALLOWED_ORIGINS.has(origin)) return { ok: false };
  return { ok: true, origin };
}

/** Combine all security + CORS headers into a single object for middleware. */
export function buildResponseHeaders(origin: string): Record<string, string> {
  return {
    ...SECURITY_HEADERS,
    ...HSTS_HEADER,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
  };
}

/** True if a pathname should be run through the rate limiter. */
export function isRateLimitedPath(pathname: string): boolean {
  return RATE_LIMITED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
