
import { serve } from "bun";
import path from "path";

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

        // Support both direct file (api/auth/login.ts) and index file (api/accounts/index.ts)
        const possiblePaths = [
            path.join(process.cwd(), "api", apiPath + ".ts"),
            path.join(process.cwd(), "api", apiPath, "index.ts"),
        ];

        let filePath = "";
        for (const p of possiblePaths) {
            if (await Bun.file(p).exists()) {
                filePath = p;
                break;
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
            let headers = new Headers({
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "http://localhost:5173",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Cookie",
            });

            if (req.method === "OPTIONS") {
                return new Response(null, { status: 204, headers });
            }

            const mockReq = {
                method: req.method,
                body,
                headers: Object.fromEntries(req.headers.entries()),
                query: Object.fromEntries(url.searchParams.entries()),
            };

            console.log(`🎬 Calling handler...`);
            let responseBody: any = null;

            const mockRes = {
                status(s: number) {
                    console.log(`🚥 Status set to ${s}`);
                    status = s;
                    return this;
                },
                json(data: any) {
                    console.log(`📄 Response:`, data);
                    responseBody = JSON.stringify(data);
                    return this;
                },
                setHeader(k: string, v: string) {
                    console.log(`🏷️ Header: ${k}=${v}`);
                    headers.set(k, v);
                    return this;
                },
                end(data?: any) {
                    console.log(`🔚 End called`);
                    responseBody = data;
                    return this;
                }
            };

            await handler(mockReq, mockRes);
            console.log(`✅ Handler finished`);

            return new Response(responseBody, {
                status,
                headers,
            });
        } catch (error: any) {
            console.error(`💥 Error in ${pathname}:`, error);
            return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    },
});
