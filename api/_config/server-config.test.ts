import { describe, expect, test } from "bun:test";
import {
	getClientId,
	isRateLimitedPath,
	resolveCorsOrigin,
	MAX_REQUEST_BODY_BYTES,
	MAX_WS_CLIENTS,
} from "./server-config.js";

describe("getClientId", () => {
	// Regression: this originally took a `Headers`-like argument and was
	// called with the Bun `Request` itself in `api/_server.ts`, which has no
	// `.get()` method. Every rate-limited route -- all four AI routes plus
	// /api/cron -- returned 500 in the dev server as a result. No test covered
	// it because the route tests exercise the handler, not the Bun entrypoint.
	test("accepts a WHATWG Headers instance", () => {
		const h = new Headers({ "x-forwarded-for": "203.0.113.9" });
		expect(getClientId(h)).toBe("203.0.113.9");
	});

	test("accepts a plain header record (Vercel shape)", () => {
		expect(getClientId({ "x-forwarded-for": "198.51.100.7" } as never)).toBe(
			"198.51.100.7",
		);
	});

	test("never throws on an unexpected shape", () => {
		// A rate limiter that crashes the request it protects is worse than one
		// that falls back to a shared bucket.
		expect(getClientId({} as never)).toBe("unknown");
		expect(getClientId(undefined as never)).toBe("unknown");
		expect(getClientId({ get: "not-a-function" } as never)).toBe("unknown");
	});

	test("takes the rightmost x-forwarded-for hop", () => {
		const h = new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" });
		expect(getClientId(h)).toBe("3.3.3.3");
	});

	test("falls back through x-real-ip then cf-connecting-ip", () => {
		expect(getClientId(new Headers({ "x-real-ip": "192.0.2.5" }))).toBe("192.0.2.5");
		expect(getClientId(new Headers({ "cf-connecting-ip": "192.0.2.6" }))).toBe(
			"192.0.2.6",
		);
	});

	test("handles an array-valued header", () => {
		expect(getClientId({ "x-real-ip": ["192.0.2.8", "10.0.0.1"] } as never)).toBe(
			"192.0.2.8",
		);
	});
});

describe("isRateLimitedPath", () => {
	test("covers the AI routes and the cron endpoint", () => {
		for (const p of [
			"/api/ai/chat",
			"/api/ai/insights",
			"/api/ai/digest",
			"/api/ai/parse-transaction",
			"/api/cron",
		]) {
			expect(isRateLimitedPath(p)).toBe(true);
		}
	});

	test("does not cover ordinary data routes", () => {
		for (const p of ["/api/accounts", "/api/transactions", "/api/profile"]) {
			expect(isRateLimitedPath(p)).toBe(false);
		}
	});
});

describe("resolveCorsOrigin", () => {
	test("accepts an explicitly allowed origin", () => {
		const local = resolveCorsOrigin("http://localhost:5173");
		expect(local.ok).toBe(true);
	});

	test("rejects a foreign *.vercel.app origin", () => {
		// This used to be accepted via regex, which handed
		// Access-Control-Allow-Credentials to anyone who deployed anything to
		// Vercel. Not account takeover only because the session cookie is
		// SameSite=Lax -- one config change away from a full compromise.
		const foreign = resolveCorsOrigin("https://attacker-anything.vercel.app");
		expect(foreign.ok).toBe(false);
	});

	test("rejects a lookalike and a subdomain-suffix attack", () => {
		expect(resolveCorsOrigin("https://evil.example/?x=app.vercel.app").ok).toBe(false);
		expect(resolveCorsOrigin("https://notlocalhost:5173.evil.com").ok).toBe(false);
		expect(resolveCorsOrigin("null").ok).toBe(false);
	});

	test("falls back for a request with no Origin header", () => {
		// curl, cron and other non-browser callers send none. CORS is not a
		// boundary for them; the shared-secret and session checks are.
		const noOrigin = resolveCorsOrigin("");
		expect(noOrigin.ok).toBe(true);
	});
});

describe("hardening limits", () => {
	test("body cap is set and sane", () => {
		expect(MAX_REQUEST_BODY_BYTES).toBeGreaterThan(1024 * 1024);
		expect(MAX_REQUEST_BODY_BYTES).toBeLessThanOrEqual(4.5 * 1024 * 1024);
	});

	test("websocket cap is bounded", () => {
		expect(MAX_WS_CLIENTS).toBeGreaterThan(0);
		expect(Number.isFinite(MAX_WS_CLIENTS)).toBe(true);
	});
});
