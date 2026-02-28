import { serve } from "bun";
import path from "path";
import type { ApiRequest, ApiResponse } from "./_types.js";

const PORT = process.env.PORT || 3001;

console.log(`🚀 API Server starting on http://localhost:${PORT}`);

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
                headers: { "Content-Type": "application/json" },
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
                    console.log(`📦 Body:`, body);
                }
            } catch (e) {
                console.warn(`⚠️ Failed to parse body: ${e}`);
            }

            let status = 200;
            const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
            const origin = req.headers.get('origin') || '';
            const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
            const headers = new Headers({
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Cookie",
            });

            if (req.method === "OPTIONS") {
                return new Response(null, { status: 204, headers });
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
                    console.log(`🚥 Status set to ${s}`);
                    status = s;
                    return this;
                },
                json(data: unknown) {
                    console.log(`📄 Response:`, data);
                    responseBody = JSON.stringify(data);
                    return this;
                },
                setHeader(k: string, v: string) {
                    console.log(`🏷️ Header: ${k}=${v}`);
                    headers.set(k, v);
                    return this;
                },
                end(data?: unknown) {
                    console.log(`🔚 End called`);
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
            const message = error instanceof Error ? error.message : "Internal Server Error";
            return new Response(JSON.stringify({ error: message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    },
});
