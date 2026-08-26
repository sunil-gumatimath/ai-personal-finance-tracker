import { describe, expect, test, mock } from "bun:test";
import {
	makeRequest,
	makeResponse,
	mockAuth,
	silenceConsoleError,
} from "./_test-utils.js";

// Mock the DB layer: the route builds SQL dynamically, so capture the
// query text + values and return a canned row set.
const capturedQueries: Array<{ text: string; values: unknown[] }> = [];
const dbRows: Array<Record<string, unknown>> = [];

mock.module("../_repositories/db.js", () => ({
	query: mock(async (text: string, values: unknown[] = []) => {
		capturedQueries.push({ text, values });
		if (text.includes("COUNT(*)")) {
			return { rows: [{ total: dbRows.length }], rowCount: 1 };
		}
		return { rows: dbRows, rowCount: dbRows.length };
	}),
}));

mock.module("../_services/audit-log.service.js", () => ({
	ensureSystemLogsTable: mock(async () => {}),
	logEvent: mock(async () => {}),
}));

const authMock = mockAuth("user-123");
const { default: handler } = await import("./logs.routes.js");

const sampleLog = {
	id: "log-1",
	timestamp: new Date().toISOString(),
	action: "USER_LOGIN",
	resource: "auth/session",
	oldValue: null,
	newValue: null,
	userId: "user-123",
	userEmail: "u@example.com",
	severity: "info",
	status: "success",
	metadata: null,
};

describe("system-logs route", () => {
	test("401 when unauthenticated", async () => {
		authMock.mockImplementation(() => Promise.resolve(null));
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toEqual({ error: "Unauthorized" });
	});

	test("200 returns logs and truthful total; no action whitelist applied", async () => {
		capturedQueries.length = 0;
		dbRows.length = 0;
		dbRows.push(sampleLog);
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest({ query: {} }), res);

		expect(captured.statusCode).toBe(200);
		const body = captured.body as { logs: unknown[]; total: number };
		expect(body.logs).toHaveLength(1);
		expect(body.total).toBe(1);

		// The read scope must NOT be restricted to transaction actions anymore.
		const selectQuery = capturedQueries.find((q) => !q.text.includes("COUNT(*)"));
		expect(selectQuery?.text).not.toContain("action IN");
		expect(selectQuery?.values[0]).toBe("user-123");
	});

	test("severity filter is parameterized and validated", async () => {
		capturedQueries.length = 0;
		const { res, captured } = makeResponse();
		await handler(makeRequest({ query: { severity: "error" } }), res);
		expect(captured.statusCode).toBe(200);
		const selectQuery = capturedQueries.find((q) => !q.text.includes("COUNT(*)"));
		expect(selectQuery?.values).toContain("error");

		const bad = makeResponse();
		await handler(makeRequest({ query: { severity: "bogus" } }), bad.res);
		expect(bad.captured.statusCode).toBe(400);
	});

	test("invalid limit is rejected with 400", async () => {
		const restore = silenceConsoleError();
		try {
			const { res, captured } = makeResponse();
			await handler(makeRequest({ query: { limit: "9999" } }), res);
			expect(captured.statusCode).toBe(400);

			const nan = makeResponse();
			await handler(makeRequest({ query: { limit: "abc" } }), nan.res);
			expect(nan.captured.statusCode).toBe(400);
		} finally {
			restore();
		}
	});

	test("valid limit is applied to the select only, never the count", async () => {
		capturedQueries.length = 0;
		const { res, captured } = makeResponse();
		await handler(makeRequest({ query: { limit: "50" } }), res);
		expect(captured.statusCode).toBe(200);
		const countQuery = capturedQueries.find((q) => q.text.includes("COUNT(*)"));
		const selectQuery = capturedQueries.find((q) => !q.text.includes("COUNT(*)"));
		expect(countQuery?.values).not.toContain(50);
		expect(selectQuery?.values.at(-1)).toBe(50);
	});

	test("non-GET methods are rejected", async () => {
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "DELETE" }), res);
		expect(captured.statusCode).toBe(405);
	});
});
