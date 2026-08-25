import { describe, expect, test } from "bun:test";
import { makeRequest, makeResponse } from "./_test-utils.js";

// Health is intentionally unauthenticated and DB-free.
const { default: handler } = await import("./health.routes.js");

describe("GET /api/health", () => {
	test("200 with a minimal ok status and no runtime details", async () => {
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ status: "ok" });
	});

	test("responds to POST with the same payload", async () => {
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "POST" }), res);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ status: "ok" });
	});
});
