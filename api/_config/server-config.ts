/**
 * Shared server config and types used by both the local Bun dev server
 * (`api/_server.ts`) and the Vercel entry point (`api/handler.ts`).
 *
 * Keeping this in one place prevents CORS / security-header / rate-limit
 * logic from drifting between the two runtimes.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  // NOTE: `X-XSS-Protection` is intentionally absent. It is deprecated and,
  // per OWASP guidance, enabling it in some older browsers can itself introduce
  // vulnerabilities. The CSP in vercel.json is the real control.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

/**
 * Hard ceiling on a request body, checked before `req.json()`.
 *
 * The body is parsed before any handler runs — therefore before
 * `getAuthedUserId` — so without a cap an unauthenticated caller could buffer
 * an arbitrarily large body and exhaust process memory. Vercel caps at
 * ~4.5 MB, so this matches it and keeps dev and prod behaviour identical.
 */
export const MAX_REQUEST_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Hard cap on concurrent log-feed WebSocket clients.
 *
 * `activeWsClients` is an uncapped `Set` and the upgrade path had no
 * rate-limit, so a single authenticated user could open unbounded connections
 * and grow the process heap. Per-client filtering already prevents any data
 * leakage, so this is a memory-only concern.
 */
export const MAX_WS_CLIENTS = 50;

/**
 * Best-effort client identity for rate limiting.
 *
 * `x-forwarded-for` and `x-real-ip` are both **client-settable** unless the
 * edge in front of the app is known to overwrite them. The previous in-code
 * comment claimed keying on the leftmost XFF entry prevented spoofing by
 * adding a hop — that only holds when a trusted proxy rewrites the header, and
 * `x-real-ip` was used verbatim whenever XFF was absent.
 *
 * Neither is a security boundary here; the limiter is a cost control. What
 * matters is that a caller cannot trivially rotate buckets.
 */
export function getClientId(headers: {
  get(name: string): string | null;
}): string {
  // Defensive: this is called from two runtimes with two different header
  // shapes (a WHATWG `Headers` from the Bun dev server, a plain record from
  // the Vercel handler). Accept either, and never throw -- a rate limiter
  // that crashes the request it is meant to protect is worse than one that
  // falls back to a shared bucket. This also caught a real bug: passing the
  // `Request` instead of `Request.headers` 500'd every AI route.
  const read = (name: string): string => {
    if (!headers) return "";
    const anyHeaders = headers as unknown as Record<string, unknown>;
    if (typeof anyHeaders.get === "function") {
      return anyHeaders.get(name) ?? "";
    }
    const value = anyHeaders[name] ?? anyHeaders[name.toLowerCase()];
    return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  };

  const forwardedFor = read("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return read("x-real-ip") || read("cf-connecting-ip") || "unknown";
}

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
  "https://tedz-finance.vercel.app",
  "https://personal-finance-tracker-tedzs-projects.vercel.app",
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
  // `/api/cron` is secret-gated and returns 403 before any DB work, so it is
  // cheap to hit — but it was unrate-limited, so anyone could flood it to
  // generate log noise. Rate limited here to blunt that; the endpoint still
  // refuses to run without CRON_SECRET (fail-closed).
  "/api/cron",
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

  origins.push("https://tedz-finance.vercel.app");
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

/**
 * Resolve an allowed CORS origin or reject the request.
 *
 * The allowlist is an exact-match `Set` built by `computeAllowedOrigins` from
 * the known local/production origins, any `ALLOWED_ORIGINS` entries, and the
 * specific hostnames Vercel injects (`VERCEL_PROJECT_PRODUCTION_URL`,
 * `VERCEL_BRANCH_URL`, `VERCEL_URL`).
 *
 * This previously ALSO accepted any `https://*.vercel.app` origin via regex,
 * which handed `Access-Control-Allow-Credentials: true` to anyone who deployed
 * anything at all to Vercel — including other projects' preview deployments. It
 * was not account takeover only because the session cookie is `SameSite=Lax`,
 * so the browser would not attach it to a cross-site fetch. That is a single
 * config change away from a full account-takeover chain, so the wildcard is
 * gone rather than left as a latent hazard.
 */
export function resolveCorsOrigin(
  origin: string,
): { ok: true; origin: string } | { ok: false } {
  if (!origin) return { ok: true, origin: FALLBACK_ORIGIN };
  if (ALLOWED_ORIGINS.has(origin)) return { ok: true, origin };
  return { ok: false };
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
