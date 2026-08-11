import { describe, expect, test } from "bun:test";
import { ValidationError, NotFoundError } from "../_errors/AppError.js";
import { OwnershipError } from "../_services/ownership.service.js";
import {
	makeRequest,
	makeResponse,
	mockAuth,
	mockService,
	silenceConsoleError,
} from "./_test-utils.js";

const authMock = mockAuth("user-123");
const service = mockService("../_services/accounts.service.js", {
	listUserAccounts: async () => [
		{ id: "acc-1", name: "Checking", balance: "100.00" },
	],
	getLinkedTransactionCount: async () => 3,
	createUserAccount: async (_req: never, _userId: string, _data: never) => ({
		id: "acc-new",
		name: "Savings",
		type: "savings",
		balance: "0.00",
	}),
	updateUserAccount: async (
		_req: never,
		_userId: string,
		_id: string,
		_data: never,
	) => ({
		id: "acc-1",
		name: "Checking",
		balance: "150.00",
	}),
	deleteUserAccount: async () => undefined,
});
const { default: handler } = await import("./accounts.routes.js");

describe("GET /api/accounts", () => {
	test("401 when not authenticated", async () => {
		authMock.mockImplementation(() => Promise.resolve(null));
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toEqual({ error: "Unauthorized" });
	});

	test("lists accounts for the authenticated user", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			accounts: [{ id: "acc-1", name: "Checking", balance: "100.00" }],
		});
		expect(service.listUserAccounts).toHaveBeenCalledWith("user-123");
	});

	test("405 for unsupported method without id", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "PATCH" }), res);
		expect(captured.statusCode).toBe(405);
		expect(captured.body).toEqual({ error: "Method not allowed" });
	});
});

describe("POST /api/accounts", () => {
	test("201 creates an account", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				body: { name: "Savings", type: "savings", balance: "0" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(201);
		expect(captured.body).toEqual({
			account: {
				id: "acc-new",
				name: "Savings",
				type: "savings",
				balance: "0.00",
			},
		});
	});

	test("400 maps ValidationError without leaking details", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.createUserAccount.mockImplementation(() =>
			Promise.reject(new ValidationError("Name is required")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "POST", body: {} }), res);
		restore();
		expect(captured.statusCode).toBe(400);
		expect(captured.body).toEqual({ error: "Name is required" });
	});

	test("500 maps unexpected failures to a generic message", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.createUserAccount.mockImplementation(() =>
			Promise.reject(new Error("connection reset")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "POST", body: { name: "X" } }), res);
		restore();
		expect(captured.statusCode).toBe(500);
		expect(captured.body).toEqual({ error: "Server error" });
	});
});

describe("PUT /api/accounts?id=…", () => {
	test("200 updates and returns the account", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "PUT",
				query: { id: "acc-1" },
				body: { balance: "150" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			account: { id: "acc-1", name: "Checking", balance: "150.00" },
		});
	});

	test("404 maps NotFoundError for a missing account", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.updateUserAccount.mockImplementation(() =>
			Promise.reject(new NotFoundError("Account not found")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "PUT", query: { id: "does-not-exist" }, body: {} }),
			res,
		);
		restore();
		expect(captured.statusCode).toBe(404);
		expect(captured.body).toEqual({ error: "Account not found" });
	});
});

describe("DELETE /api/accounts?id=…", () => {
	test("200 deletes and returns ok", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "DELETE", query: { id: "acc-1", cascade: "1" } }),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ ok: true });
		expect(service.deleteUserAccount).toHaveBeenCalledWith(
			expect.anything(),
			"user-123",
			"acc-1",
			true,
		);
	});

	test("403 maps OwnershipError (cross-user access attempt)", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.deleteUserAccount.mockImplementation(() =>
			Promise.reject(
				new OwnershipError("Account does not belong to user", 403),
			),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "DELETE", query: { id: "acc-other" } }),
			res,
		);
		restore();
		expect(captured.statusCode).toBe(403);
		expect(captured.body).toEqual({
			error: "Account does not belong to user",
		});
	});
});

describe("GET /api/accounts?action=linked-count", () => {
	test("400 when accountId is missing", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest({ query: { action: "linked-count" } }), res);
		expect(captured.statusCode).toBe(400);
		expect(captured.body).toEqual({ error: "Missing accountId" });
	});

	test("returns linked transaction count", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ query: { action: "linked-count", accountId: "acc-1" } }),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ count: 3 });
	});
});
