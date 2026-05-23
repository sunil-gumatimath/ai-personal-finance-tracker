import "./_lib/utils/dns-bypass.js";
import { serve } from "bun";
import path from "path";
import type { ApiRequest, ApiResponse } from "./_lib/utils/types.js";
import { checkRateLimit } from "./_lib/middleware/rate-limiter.js";
import { query } from "./_lib/services/db.js";
import { logEvent, activeWsClients } from "./_lib/services/logger.js";

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

// Endpoints that require stricter rate limiting.
// Auth has action-specific limits inside api/auth.ts, so it is not limited here.
const RATE_LIMITED_PREFIXES = ["/api/ai/chat", "/api/ai/insights"];

async function ensureSystemLogsTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email TEXT,
        severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
        status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure')),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);
    
    await query(`CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity);`);
    
    console.log("✅ Database system_logs table and indexes verified.");
    
    // Log server boot
    await logEvent(null, {
      action: "DEPLOYMENT_EVENT",
      resource: "system/server",
      newValue: "System server booted successfully.",
      severity: "info",
      status: "success",
      metadata: { port: PORT, env: process.env.NODE_ENV || 'development' }
    });
  } catch (error) {
    console.error("❌ Failed to ensure system_logs table:", error);
  }
}

ensureSystemLogsTable();

try {
serve({
    port: PORT,
    async fetch(req, server) {
        const url = new URL(req.url);
        const pathname = url.pathname;

        // Upgrade WebSocket connections for /api/ws-logs
        if (pathname === "/api/ws-logs") {
            if (server.upgrade(req)) {
                return; // upgrade successful
            }
            return new Response("WebSocket upgrade failed", { status: 400 });
        }

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

        // 1. Check exact match: api/handlers/some/path.ts
        const exactPath = path.join(process.cwd(), "api", "handlers", apiPath + ".ts");
        if (await Bun.file(exactPath).exists()) {
            filePath = exactPath;
        }

        // 2. Check index match: api/handlers/some/path/index.ts
        if (!filePath) {
            const indexPath = path.join(process.cwd(), "api", "handlers", apiPath, "index.ts");
            if (await Bun.file(indexPath).exists()) {
                filePath = indexPath;
            }
        }

        // 3. Check dynamic match: api/handlers/some/[id].ts
        if (!filePath) {
            const parts = apiPath.split("/");
            if (parts.length > 0) {
                const lastPart = parts.pop();
                const parentPath = parts.join("/");
                const dynamicPath = path.join(process.cwd(), "api", "handlers", parentPath, "[id].ts");

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
                "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
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
            
            // Log unhandled server error
            logEvent(null, {
                action: "ERROR",
                resource: pathname,
                newValue: error instanceof Error ? error.message : String(error),
                severity: "critical",
                status: "failure",
                metadata: {
                    stack: error instanceof Error ? error.stack : undefined,
                    method: req.method
                }
            }).catch(err => console.error("Failed to log server exception:", err));

            // Never leak internal error details to the client
            return new Response(JSON.stringify({ error: "Internal Server Error" }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...SECURITY_HEADERS },
            });
        }
    },
    websocket: {
        open(ws) {
            console.log("🔌 Live logs WebSocket connection opened");
            activeWsClients.add(ws);
        },
        message(ws, message) {
            // No-op
        },
        close(ws) {
            console.log("🔌 Live logs WebSocket connection closed");
            activeWsClients.delete(ws);
        }
    }
});
} catch (error: any) {
    if (error.code === "EADDRINUSE" || (error.message && error.message.includes("EADDRINUSE"))) {
        console.error(`\n❌ Failed to start API server: Port ${PORT} is already in use!`);
        console.error(`💡 Tips to resolve this:`);
        if (process.platform === "win32") {
            console.error(`   Run the following command in PowerShell to free port ${PORT}:`);
            console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`);
        } else {
            console.error(`   Run the following command in Terminal to free port ${PORT}:`);
            console.error(`   kill -9 $(lsof -t -i:${PORT})`);
        }
        console.error();
        process.exit(1);
    } else {
        throw error;
    }
}
