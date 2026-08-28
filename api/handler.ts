import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ApiRequest, ApiResponse } from "./_utils/types.js";
import { checkRateLimit } from "./_middleware/rate-limit.js";
import {
	buildResponseHeaders,
	isRateLimitedPath,
	resolveCorsOrigin,
} from "./_config/server-config.js";
import { resolveRoute } from "./_routes/index.js";
import { logEvent } from "./_services/audit-log.service.js";

// Allow long-running AI requests (free-tier reasoning models are slow).
// Hobby plan serverless functions can run up to 60s; the AbortSignal in
// api/services/_ai_kilocode.ts stays below this ceiling.
export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const url = new URL(req.url!, `https://${req.headers.host || "localhost"}`);
	const pathname = url.pathname;

	if (!pathname.startsWith("/api/")) {
		res.status(404).json({ error: "Not Found" });
		return;
	}

	const apiPath = pathname.replace(/^\/api\//, "");
	const routeHandler = resolveRoute(apiPath);

	if (!routeHandler) {
		res.status(404).json({ error: `Route ${pathname} not found` });
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

	if (isRateLimitedPath(pathname)) {
		// Key on the leftmost x-forwarded-for entry — that is the original
		// client; the raw header may chain multiple proxy IPs and would let
		// anyone rotate their key by spoofing an extra hop.
		const forwardedFor = req.headers["x-forwarded-for"] as string | undefined;
		const clientId =
			forwardedFor?.split(",")[0]?.trim() ||
			(req.headers["x-real-ip"] as string | undefined) ||
			"unknown";
		// Auth routes apply their own stricter limiting inside auth.routes.ts.
		const { allowed, retryAfter } = await checkRateLimit(clientId, pathname);
		if (!allowed) {
			res.setHeader("Retry-After", String(retryAfter ?? 60));
			res
				.status(429)
				.json({ error: "Rate limit exceeded. Please try again later." });
			return;
		}
	}

	let body: Record<string, unknown> = {};
	if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
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
			Object.entries(req.query).map(([k, v]) => [
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
