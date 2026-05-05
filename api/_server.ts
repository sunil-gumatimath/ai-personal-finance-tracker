import { serve } from "bun";
import path from "path";
import type { ApiRequest, ApiResponse } from "./_types.js";
import { checkRateLimit } from "./_rate-limiter.js";

const PORT = process.env.PORT || 3001;

console.log(`🚀 API Server starting on http://localhost:${PORT}`);

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

// Production HSTS header (only added when not in local development)
const HSTS_HEADER: Record<string, string> = process.env.NODE_ENV === "production"
  ? { "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload" }
  : {};

// Endpoints that require stricter rate limiting
const RATE_LIMITED_PREFIXES = ["/api/auth", "/api/ai/chat", "/api/ai/insights"];

serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        const pathname = url.pathname;

        if (!pathname.startsWith("/api/")) {
            return new Response("Not Found", { status: 404 });
        }

        // Route /api/auth/login to api/auth/login.ts
        const apiPath = pathname.replace(/^\/api\//, "");

        // Security: block path traversal attempts
        if (apiPath.includes('..') || apiPath.includes('\0') || apiPath.includes('\\')) {
            return new Response(JSON.stringify({ error: 'Invalid path' }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...SECURITY_HEADERS },
            });
        }

        let filePath = "";
        const extraParams: Record<string, string> = {};

        // 1. Check exact match: api/some/path.ts
        const exactPath = path.join(process.cwd(), "api", apiPath + ".ts");
        if (await Bun.file(exactPath).exists()) {
            filePath = exactPath;
        }

        // 2. Check index: api/some/path/index.ts
        if (!filePath) {
            const indexPath = path.join(process.cwd(), "api", apiPath, "index.ts");
            if (await Bun.file(indexPath).exists()) {
                filePath = indexPath;
            }
        }

        // 3. Check for dynamic route [id].ts in the parent folder
        // e.g. api/transactions/123 -> api/transactions/[id].ts
        if (!filePath) {
            const parts = apiPath.split("/");
            if (parts.length > 0) {
                const lastPart = parts.pop(); // The ID, e.g. "123"
                const parentPath = parts.join("/"); // e.g. "transactions"
                const dynamicPath = path.join(process.cwd(), "api", parentPath, "[id].ts");

                if (await Bun.file(dynamicPath).exists()) {
                    filePath = dynamicPath;
                    if (lastPart) {
                        extraParams.id = lastPart;
                    }
                }
            }
        }

        if (!filePath) {
            console.log(`❌ 404: ${pathname}`);
            return new Response(JSON.stringify({ error: `Route ${pathname} not found` }), {
                status: 404,
                headers: { "Content-Type": "application/json", ...SECURITY_HEADERS },
            });
        }

        try {
            console.log(`✨ ${req.method} ${pathname}`);
            const module = await import(filePath);
            const handler = module.default;

            if (typeof handler !== "function") {
                throw new Error(`Default export in ${filePath} is not a function`);
            }

            // Mock Vercel req/res
            let body = {};
            try {
                if (req.method !== "GET") {
                    body = await req.json();
                }
            } catch (e) {
                console.warn(`⚠️ Failed to parse body: ${e}`);
            }

            let status = 200;
            const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
            const origin = req.headers.get('origin') || '';

            // Reject requests from disallowed origins instead of falling back
            if (origin && !allowedOrigins.includes(origin)) {
                return new Response(JSON.stringify({ error: 'Forbidden - origin not allowed' }), {
                    status: 403,
                    headers: { "Content-Type": "application/json", ...SECURITY_HEADERS },
                });
            }

            const corsOrigin = origin || allowedOrigins[0];

            const headers = new Headers({
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Cookie",
                ...SECURITY_HEADERS,
                ...HSTS_HEADER,
            });

            if (req.method === "OPTIONS") {
                return new Response(null, { status: 204, headers });
            }

            // Rate limiting for sensitive endpoints
            const isRateLimited = RATE_LIMITED_PREFIXES.some(prefix => pathname.startsWith(prefix));
            if (isRateLimited) {
                const clientId = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
                const isAuth = pathname.startsWith('/api/auth');
                const { allowed, retryAfter } = checkRateLimit(clientId, pathname, isAuth);
                if (!allowed) {
                    headers.set('Retry-After', String(retryAfter ?? 60));
                    return new Response(
                        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
                        { status: 429, headers }
                    );
                }
            }

            const mockReq: ApiRequest = {
                method: req.method,
                body: body as Record<string, unknown>,
                headers: Object.fromEntries(req.headers.entries()),
                query: { ...Object.fromEntries(url.searchParams.entries()), ...extraParams },
            };

            console.log(`🎬 Calling handler...`);
            let responseBody: string | null = null;

            const mockRes: ApiResponse = {
                status(s: number) {
                    status = s;
                    return this;
                },
                json(data: unknown) {
                    responseBody = JSON.stringify(data);
                    return this;
                },
                setHeader(k: string, v: string | string[]) {
                    headers.set(k, Array.isArray(v) ? v.join(", ") : v);
                    return this;
                },
                end(data?: unknown) {
                    responseBody = typeof data === "string" ? data : data == null ? null : String(data);
                    return this;
                }
            };

            await handler(mockReq, mockRes);
            console.log(`✅ Handler finished`);

            return new Response(responseBody, {
                status,
                headers,
            });
        } catch (error: unknown) {
            console.error(`💥 Error in ${pathname}:`, error);
            // Never leak internal error details to the client
            return new Response(JSON.stringify({ error: "Internal Server Error" }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...SECURITY_HEADERS },
            });
        }
    },
});
