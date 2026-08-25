import { describe, expect, test } from "bun:test";
import {
	makeRequest,
	makeResponse,
	mockService,
	silenceConsoleError,
} from "./_test-utils.js";

// The cron endpoint is not user-authenticated; it only needs the two
// transactions.service functions it calls. Mock them like sibling tests do.
// NOTE: the fake below intentionally mirrors the service's FULL public API —
// Bun workers reuse one process across test files, and this registration may
// still be the one in effect when another route module (e.g.
// transactions.routes.js) is first imported. A partial mock there would break
// that file's import bindings.
const service = mockService("../_services/transactions.service.js", {
	listUserTransactions: async () => [],
	createUserTransaction: async () => ({ id: "tx-new" }),
	updateUserTransaction: async () => ({ id: "tx-upd" }),
	deleteUserTransaction: async () => undefined,
	listUsersWithDueRecurring: async () => ["user-1", "user-2"],
	processDueRecurringTransactions: async () => ({
		created: [{ id: "occ-1" }],
		completed: 0,
	}),
});
const { default: handler } = await import("./cron.routes.js");

const SECRET = "test-cron-secret";

/**
 * Run `fn` with CRON_SECRET set/unset, restoring the previous value after.
 * Returns `fn()`'s result so callers can `await withSecret(…, async () => …)`.
 */
function withSecret(value: string | undefined, fn: () => unknown): unknown {
	const previous = process.env.CRON_SECRET;
	if (value === undefined) {
		delete process.env.CRON_SECRET;
	} else {
		process.env.CRON_SECRET = value;
	}
	try {
		return fn();
	} finally {
		if (previous === undefined) {
			delete process.env.CRON_SECRET;
		} else {
			process.env.CRON_SECRET = previous;
		}
	}
}

function authedHeaders(method: string) {
	return {
		method,
		headers: { authorization: `Bearer ${SECRET}` },
	};
}

describe("cron route", () => {
	test("GET with a valid secret runs the recurring job (Vercel Crons)", async () => {
		await withSecret(SECRET, async () => {
			const { res, captured } = makeResponse();
			await handler(makeRequest(authedHeaders("GET")), res);
			expect(captured.statusCode).toBe(200);
			expect(captured.body).toMatchObject({
				ok: true,
				action: "recurring",
				usersProcessed: 2,
				occurrencesCreated: 2,
				seriesCompleted: 0,
			});
		});
	});

	test("POST with a valid secret also runs the job", async () => {
		await withSecret(SECRET, async () => {
			const { res, captured } = makeResponse();
			await handler(
				makeRequest({ ...authedHeaders("POST"), query: { action: "recurring" } }),
				res,
			);
			expect(captured.statusCode).toBe(200);
			expect(captured.body).toMatchObject({ ok: true, action: "recurring" });
		});
	});

	test("defaults the action to recurring when the query param is absent", async () => {
		await withSecret(SECRET, async () => {
			service.processDueRecurringTransactions.mockClear();
			const { res, captured } = makeResponse();
			await handler(makeRequest(authedHeaders("GET")), res);
			expect(captured.statusCode).toBe(200);
			expect(service.processDueRecurringTransactions).toHaveBeenCalledWith(
				"user-1",
			);
		});
	});

	test("403 for a wrong secret", async () => {
		await withSecret(SECRET, async () => {
			const { res, captured } = makeResponse();
			await handler(
				makeRequest({
					method: "GET",
					headers: { authorization: "Bearer wrong-secret" },
				}),
				res,
			);
			expect(captured.statusCode).toBe(403);
			expect(captured.body).toEqual({ error: "Forbidden" });
		});
	});

	test("403 for a wrong x-cron-secret header", async () => {
		await withSecret(SECRET, async () => {
			const { res, captured } = makeResponse();
			await handler(
				makeRequest({
					method: "GET",
					headers: { "x-cron-secret": "nope" },
				}),
				res,
			);
			expect(captured.statusCode).toBe(403);
		});
	});

	test("401 when no credentials are presented", async () => {
		await withSecret(SECRET, async () => {
			const { res, captured } = makeResponse();
			await handler(makeRequest({ method: "GET" }), res);
			expect(captured.statusCode).toBe(401);
			expect(captured.body).toEqual({ error: "Unauthorized" });
		});
	});

	test("503 when CRON_SECRET is not configured (fail-safe)", async () => {
		await withSecret(undefined, async () => {
			const restore = silenceConsoleError();
			const { res, captured } = makeResponse();
			await handler(
				makeRequest({
					method: "GET",
					headers: { authorization: `Bearer ${SECRET}` },
				}),
				res,
			);
			restore();
			expect(captured.statusCode).toBe(503);
			expect(JSON.stringify(captured.body)).toContain("CRON_SECRET");
		});
	});

	test("400 for an unknown action", async () => {
		await withSecret(SECRET, async () => {
			const { res, captured } = makeResponse();
			await handler(
				makeRequest({ ...authedHeaders("GET"), query: { action: "explode" } }),
				res,
			);
			expect(captured.statusCode).toBe(400);
			expect(JSON.stringify(captured.body)).toContain("Unknown cron action");
		});
	});

	test("405 for unsupported methods", async () => {
		await withSecret(SECRET, async () => {
			for (const method of ["PUT", "DELETE", "PATCH"]) {
				const { res, captured } = makeResponse();
				await handler(makeRequest(authedHeaders(method)), res);
				expect(captured.statusCode).toBe(405);
				expect(captured.body).toEqual({ error: "Method not allowed" });
			}
		});
	});

	test("500 maps processing failures to a generic message", async () => {
		await withSecret(SECRET, async () => {
			service.listUsersWithDueRecurring.mockImplementation(() =>
				Promise.reject(new Error("db down")),
			);
			const restore = silenceConsoleError();
			const { res, captured } = makeResponse();
			await handler(makeRequest(authedHeaders("GET")), res);
			restore();
			expect(captured.statusCode).toBe(500);
			expect(captured.body).toEqual({ error: "Server error" });
			expect(JSON.stringify(captured.body)).not.toContain("db down");
		});
	});
});
