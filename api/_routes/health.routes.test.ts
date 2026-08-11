import { describe, expect, test } from "bun:test";
import { makeRequest, makeResponse } from "./_test-utils.js";

// Health is intentionally unauthenticated and DB-free.
const { default: handler } = await import("./health.routes.js");

describe("GET /api/health", () => {
	test("200 with status ok without authentication", async () => {
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(200);
		const body = captured.body as {
			status: string;
			uptime: number;
			timestamp: string;
		};
		expect(body.status).toBe("ok");
		expect(typeof body.uptime).toBe("number");
		expect(Number.isNaN(new Date(body.timestamp).getTime())).toBe(false);
	});

	test("responds to POST with the same payload", async () => {
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "POST" }), res);
		expect(captured.statusCode).toBe(200);
		expect((captured.body as { status: string }).status).toBe("ok");
	});
});
