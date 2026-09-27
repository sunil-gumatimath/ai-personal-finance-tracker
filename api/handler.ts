import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ApiRequest, ApiResponse } from "./_utils/types.js";
import { checkRateLimit } from "./_middleware/rate-limit.js";
import {
	buildResponseHeaders,
	getClientId,
	isRateLimitedPath,
	MAX_REQUEST_BODY_BYTES,
	resolveCorsOrigin,
} from "./_config/server-config.js";
import { resolveRouteEntry } from "./_routes/index.js";
import { logEvent } from "./_services/audit-log.service.js";

// Allow long-running AI requests (free-tier reasoning models are slow).
// Hobby plan serverless functions can run up to 60s; the AbortSignal in
// api/services/_ai_kilocode.ts stays below this ceiling.
export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const url = new URL(req.url!, `https://${req.headers.host || "localhost"}`);
	let pathname = url.pathname;

	// Vercel rewrites /api/:path* -> /api/handler?path=:path* (see vercel.json).
	// After the rewrite pathname is /api/handler, so the real route lives in
	// query.path. Prefer it when present; fall back to the raw pathname for
	// direct invocations and local emulation.
	const rawPathQuery = (req.query as Record<string, unknown> | undefined)?.path;
	let apiPath: string;
	if (typeof rawPathQuery === "string" && rawPathQuery.length > 0) {
		apiPath = rawPathQuery.replace(/^\/api\//, "").replace(/^\//, "");
		pathname = `/api/${apiPath}`;
	} else if (Array.isArray(rawPathQuery) && rawPathQuery.length > 0) {
		apiPath = String(rawPathQuery.join("/")).replace(/^\/api\//, "").replace(/^\//, "");
		pathname = `/api/${apiPath}`;
	} else {
		if (!pathname.startsWith("/api/")) {
			res.status(404).json({ error: "Not Found" });
			return;
		}
		apiPath = pathname.replace(/^\/api\//, "");
	}
	// Strip the /api/handler self-reference if routing ever lands here directly.
	if (apiPath === "handler" || apiPath.startsWith("handler/")) {
		apiPath = apiPath.replace(/^handler\/?/, "");
		if (!apiPath) {
			res.status(404).json({ error: "Route /api/handler not found" });
			return;
		}
		pathname = `/api/${apiPath}`;
	}
	const route = resolveRouteEntry(apiPath);

	if (!route) {
		res.status(404).json({ error: `Route ${pathname} not found` });
		return;
	}
	const routeHandler = route.handler;

	// `/api/ws-logs` is not part of the route registry — it is a raw socket
	// upgrade handled by the Bun dev server. Reject it explicitly here rather
	// than letting it fall through to the 404 path.
	if (apiPath === "ws-logs") {
		res.status(404).json({ error: "WebSocket upgrade is not available on this runtime" });
		return;
	}

	// CORS: reject disallowed origins before doing any work
	const origin = (req.headers.origin as string) || "";
	const cors = resolveCorsOrigin(origin);
	if (!cors.ok) {
		res.status(403).json({ error: "Forbidden - origin not allowed" });
		return;
	}

	const headers = buildResponseHeaders(cors.origin);
	for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

	if (req.method === "OPTIONS") {
		res.status(204).end();
		return;
	}

	// Rate limiting keyed on the CANONICAL route key, not the raw path. The
	// route lookup walks up path segments, so `/api/ai/chat`, `/api/ai/chat/a`
	// and `/api/ai/chat/1` all reach the same handler; keying on the raw path
	// gave each variant its own fresh budget against the LLM-backed routes.
	const canonicalPath = `/api/${route.key}`;
	if (isRateLimitedPath(canonicalPath)) {
		// Auth routes apply their own stricter limiting inside auth.routes.ts.
		const { allowed, retryAfter } = await checkRateLimit(
			getClientId({
				get: (name) => {
					const v = req.headers[name];
					return Array.isArray(v) ? v.join(", ") : v ?? null;
				},
			}),
			canonicalPath,
		);
		if (!allowed) {
			res.setHeader("Retry-After", String(retryAfter ?? 60));
			res
				.status(429)
				.json({ error: "Rate limit exceeded. Please try again later." });
			return;
		}
	}

	// Reject an oversized body before parsing it. Vercel pre-parses `req.body`
	// with its own cap, but an explicitly-declared oversize payload is cheaper
	// to refuse here and keeps dev/prod behaviour identical.
	const declaredLength = Number(req.headers["content-length"] ?? "0");
	if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
		res.status(413).json({ error: "Request body too large" });
		return;
	}

	let body: Record<string, unknown> = {};
	if (typeof req.body === "string" && req.body.length > 0) {
		try {
			const parsed: unknown = JSON.parse(req.body);
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				body = parsed as Record<string, unknown>;
			}
		} catch {
			// non-JSON raw body — leave as empty object so routes return 400, not 500
		}
	} else if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
		body = req.body as Record<string, unknown>;
	}

	const apiReq: ApiRequest = {
		method: req.method,
		body,
		signal: (req as unknown as { signal?: AbortSignal }).signal,
		headers: Object.fromEntries(
			Object.entries(req.headers).map(([k, v]) => [
				k,
				Array.isArray(v) ? v.join(", ") : v || "",
			]),
		) as ApiRequest["headers"],
		query: Object.fromEntries(
			Object.entries(req.query)
				.filter(([k]) => k !== "path")
				.map(([k, v]) => [
					k,
					Array.isArray(v) ? v[0] : v || "",
				]),
		) as ApiRequest["query"],
	};

	let responseStatus = 200;
	let streamStarted = false;
	const apiRes: ApiResponse = {
		status(code) {
			responseStatus = code;
			return this;
		},
		json(data) {
			res.status(responseStatus).json(data);
			return this;
		},
		setHeader(k, v) {
			res.setHeader(k, Array.isArray(v) ? v.join(", ") : v);
			return this;
		},
		end(data) {
			res
				.status(responseStatus)
				.send(
					typeof data === "string" ? data : data == null ? "" : String(data),
				);
			return this;
		},
		startChunkedStream(contentType) {
			if (streamStarted || res.headersSent) return null;
			streamStarted = true;
			res.status(200);
			res.setHeader("Content-Type", contentType);
			res.setHeader("Cache-Control", "no-cache, no-transform");
			// Disable proxy buffering so chunks flush to the client immediately.
			res.setHeader("X-Accel-Buffering", "no");
			return {
				write(chunk) {
					res.write(chunk);
				},
				close() {
					res.end();
				},
			};
		},
	};

	try {
		await routeHandler(apiReq, apiRes);
	} catch (error) {
		console.error(`Error in ${pathname}:`, error);

		// Once a chunked stream has started the status line is already sent;
		// surface the failure as a final stream event instead of a 500 JSON body.
		if (streamStarted && !res.writableEnded) {
			res.write(
				`${JSON.stringify({ type: "error", message: "Internal Server Error" })}\n`,
			);
			res.end();
			return;
		}

		logEvent(null, {
			action: "ERROR",
			resource: pathname,
			newValue: error instanceof Error ? error.message : String(error),
			severity: "critical",
			status: "failure",
			metadata: {
				stack: error instanceof Error ? error.stack : undefined,
				method: req.method,
			},
		}).catch((err) => console.error("Failed to log server exception:", err));

		res.status(500).json({ error: "Internal Server Error" });
	}
}
