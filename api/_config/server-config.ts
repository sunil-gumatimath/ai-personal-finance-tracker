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
 * In production the deployed Vercel URL should be in here.
 */
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://personal-finance-tracker-ted.vercel.app",
];

/** Endpoints with stricter rate limits. Auth routes are limited inside auth.ts. */
const RATE_LIMITED_PREFIXES = ["/api/ai/chat", "/api/ai/insights"];

/**
 * Fallback currency used when a profile has none set. Kept in one place so
 * the AI routes never disagree about formatting defaults.
 */
export const DEFAULT_CURRENCY = "INR";

/** Resolve an allowed CORS origin or reject the request. */
export function resolveCorsOrigin(
  origin: string,
): { ok: true; origin: string } | { ok: false } {
  if (!origin) return { ok: true, origin: ALLOWED_ORIGINS[0] };
  if (!ALLOWED_ORIGINS.includes(origin)) return { ok: false };
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
