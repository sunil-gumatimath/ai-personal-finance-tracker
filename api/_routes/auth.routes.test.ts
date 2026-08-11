import { describe, expect, test, mock } from "bun:test";
import { makeRequest, makeResponse } from "./_test-utils.js";

// ── Mocks (registered before the route import) ─────────────────────────────

const authMocks = {
	authClient: {
		signIn: {
			email: mock<
				(...args: never[]) => Promise<{ data: unknown; error: unknown }>
			>(async () => ({ data: null, error: null })),
		},
		signUp: {
			email: mock<
				(...args: never[]) => Promise<{ data: unknown; error: unknown }>
			>(async () => ({ data: null, error: null })),
		},
	},
	getAuthOrigin: mock<(...args: never[]) => string>(
		() => "https://example.com",
	),
	getAuthedUserId: mock<(...args: never[]) => Promise<string | null>>(
		async () => "user-123",
	),
	getRequestToken: mock<(...args: never[]) => string>(() => "tok-1"),
	buildSessionCookie: mock<(token: string) => string>(
		(token: string) => `pft_session=${token}; HttpOnly`,
	),
	buildClearedSessionCookie: mock<(...args: never[]) => string>(
		() => "pft_session=; Max-Age=0",
	),
};

mock.module("../_services/auth.service.js", () => authMocks);

const dbMocks = {
	query: mock<
		(...args: never[]) => Promise<{ rows: unknown[]; rowCount: number }>
	>(async () => ({ rows: [], rowCount: 0 })),
	queryOne: mock<(...args: never[]) => Promise<unknown>>(async () => null),
};
mock.module("../_repositories/db.js", () => dbMocks);

const rateMocks = {
	checkRateLimit: mock<
		(
			...args: never[]
		) => Promise<{ allowed: boolean; retryAfter: number | null }>
	>(async () => ({ allowed: true, retryAfter: null })),
	recordFailedAttempt: mock<(...args: never[]) => Promise<void>>(
		async () => undefined,
	),
};
mock.module("../_middleware/rate-limit.js", () => rateMocks);

const logMocks = {
	logEvent: mock<(...args: never[]) => Promise<unknown>>(async () => undefined),
};
mock.module("../_services/audit-log.service.js", () => logMocks);

const categoriesMocks = {
	ensureDefaultCategories: mock<(...args: never[]) => Promise<unknown>>(
		async () => undefined,
	),
};
mock.module("../_utils/default-categories.js", () => categoriesMocks);

const { default: handler } = await import("./auth.routes.js");

const meUser = {
	id: "user-123",
	email: "a@b.com",
	full_name: "Ann",
	avatar_url: null,
	created_at: "2026-01-01T00:00:00Z",
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("auth dispatch", () => {
	test("405 for unknown or missing action", async () => {
		const { res, captured } = makeResponse();
		await handler(makeRequest({ query: {} }), res);
		expect(captured.statusCode).toBe(405);
		expect(captured.body).toEqual({ error: "Method not allowed" });
	});

	test("405 for an unregistered action", async () => {
		const { res, captured } = makeResponse();
		await handler(makeRequest({ query: { action: "nope" } }), res);
		expect(captured.statusCode).toBe(405);
		expect(captured.body).toEqual({ error: "Method not allowed" });
	});
});

describe("auth?action=me", () => {
	test("405 when method is not GET", async () => {
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "POST", query: { action: "me" } }),
			res,
		);
		expect(captured.statusCode).toBe(405);
	});

	test("401 when not authenticated", async () => {
		authMocks.getAuthedUserId.mockImplementation(async () => null);
		const { res, captured } = makeResponse();
		await handler(makeRequest({ query: { action: "me" } }), res);
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toEqual({ error: "Unauthorized" });
	});

	test("401 when the user row is missing", async () => {
		authMocks.getAuthedUserId.mockImplementation(async () => "user-123");
		dbMocks.queryOne.mockImplementation(async () => null);
		const { res, captured } = makeResponse();
		await handler(makeRequest({ query: { action: "me" } }), res);
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toEqual({ error: "User not found" });
	});

	test("200 returns the user profile shape", async () => {
		authMocks.getAuthedUserId.mockImplementation(async () => "user-123");
		dbMocks.queryOne.mockImplementation(async () => meUser);
		const { res, captured } = makeResponse();
		await handler(makeRequest({ query: { action: "me" } }), res);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			user: {
				id: "user-123",
				email: "a@b.com",
				user_metadata: { full_name: "Ann", avatar_url: null },
				app_metadata: {},
				aud: "authenticated",
				created_at: "2026-01-01T00:00:00Z",
			},
		});
	});
});

describe("auth?action=logout", () => {
	test("405 when method is not POST", async () => {
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "GET", query: { action: "logout" } }),
			res,
		);
		expect(captured.statusCode).toBe(405);
	});

	test("200 clears the session cookie and deletes the session row", async () => {
		authMocks.getRequestToken.mockImplementation(() => "tok-1");
		dbMocks.query.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "POST", query: { action: "logout" } }),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ ok: true });
		expect(dbMocks.query).toHaveBeenCalledWith(
			"DELETE FROM neon_auth.session WHERE token = $1",
			["tok-1"],
		);
		expect(captured.headers["Set-Cookie"]).toContain("pft_session=;");
	});
});

describe("auth?action=delete-account", () => {
	test("405 when method is not DELETE", async () => {
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "GET", query: { action: "delete-account" } }),
			res,
		);
		expect(captured.statusCode).toBe(405);
	});

	test("401 when not authenticated", async () => {
		authMocks.getAuthedUserId.mockImplementation(async () => null);
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "DELETE", query: { action: "delete-account" } }),
			res,
		);
		expect(captured.statusCode).toBe(401);
	});

	test("200 wipes user rows, clears cookie, and logs the event", async () => {
		authMocks.getAuthedUserId.mockImplementation(async () => "user-123");
		dbMocks.queryOne.mockImplementation(async () => ({ email: "a@b.com" }));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "DELETE", query: { action: "delete-account" } }),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			ok: true,
			message: "Account deleted completely",
		});
		expect(captured.headers["Set-Cookie"]).toContain("pft_session=;");
		expect(dbMocks.queryOne).toHaveBeenCalledWith(
			"DELETE FROM public.users WHERE id = $1",
			["user-123"],
		);
		expect(logMocks.logEvent).toHaveBeenCalledWith(
			null,
			expect.objectContaining({ action: "USER_DELETED", severity: "critical" }),
		);
	});
});

describe("auth?action=login", () => {
	test("405 when method is not POST", async () => {
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "GET", query: { action: "login" } }),
			res,
		);
		expect(captured.statusCode).toBe(405);
	});

	test("429 when the rate limiter rejects the attempt", async () => {
		rateMocks.checkRateLimit.mockImplementation(async () => ({
			allowed: false,
			retryAfter: 30,
		}));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				query: { action: "login" },
				body: { email: "a@b.com", password: "x" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(429);
		expect(captured.body).toEqual({
			error: "Too many login attempts. Please try again later.",
		});
	});

	test("400 when email or password is missing", async () => {
		rateMocks.checkRateLimit.mockImplementation(async () => ({
			allowed: true,
			retryAfter: null,
		}));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				query: { action: "login" },
				body: { email: "" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(400);
		expect(captured.body).toEqual({ error: "Email and password are required" });
	});

	test("401 when credentials are invalid and failure is recorded", async () => {
		authMocks.authClient.signIn.email.mockImplementation(async () => ({
			data: null,
			error: new Error("Invalid email or password"),
		}));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				query: { action: "login" },
				body: { email: "a@b.com", password: "wrong" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toEqual({ error: "Invalid email or password" });
		expect(rateMocks.recordFailedAttempt).toHaveBeenCalledWith(
			"unknown",
			"login",
		);
	});

	test("200 sets the session cookie and returns the user", async () => {
		authMocks.authClient.signIn.email.mockImplementation(async () => ({
			data: {
				user: {
					id: "user-123",
					email: "a@b.com",
					name: "Ann",
					image: null,
					createdAt: "2026-01-01T00:00:00Z",
				},
				token: "tok-new",
			},
			error: null,
		}));
		dbMocks.queryOne.mockImplementation(async () => null);
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				query: { action: "login" },
				body: { email: "a@b.com", password: "secret" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.headers["Set-Cookie"]).toContain("pft_session=tok-new");
		expect(captured.body).toEqual({
			user: {
				id: "user-123",
				email: "a@b.com",
				user_metadata: { full_name: "Ann", avatar_url: null },
				app_metadata: {},
				aud: "authenticated",
				created_at: "2026-01-01T00:00:00Z",
			},
		});
	});

	test("502 when Neon Auth succeeds but no session token is issued", async () => {
		authMocks.authClient.signIn.email.mockImplementation(async () => ({
			data: {
				user: {
					id: "user-123",
					email: "a@b.com",
					name: "Ann",
					image: null,
					createdAt: "2026-01-01T00:00:00Z",
				},
				token: null,
			},
			error: null,
		}));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				query: { action: "login" },
				body: { email: "a@b.com", password: "secret" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(502);
		expect(captured.body).toEqual({
			error: "Authentication session was not created",
		});
	});
});

describe("auth?action=signup", () => {
	test("429 when the rate limiter rejects the attempt", async () => {
		rateMocks.checkRateLimit.mockImplementation(async () => ({
			allowed: false,
			retryAfter: 60,
		}));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				query: { action: "signup" },
				body: { email: "a@b.com", password: "x", fullName: "Ann" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(429);
		expect(captured.body).toEqual({
			error: "Too many signup attempts. Please try again later.",
		});
	});

	test("400 when fields are missing", async () => {
		rateMocks.checkRateLimit.mockImplementation(async () => ({
			allowed: true,
			retryAfter: null,
		}));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "POST", query: { action: "signup" }, body: {} }),
			res,
		);
		expect(captured.statusCode).toBe(400);
		expect(captured.body).toEqual({
			error: "Email, password, and full name are required",
		});
	});
});
