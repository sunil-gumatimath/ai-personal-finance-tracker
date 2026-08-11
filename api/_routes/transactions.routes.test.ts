import { describe, expect, test } from "bun:test";
import { NotFoundError, ValidationError } from "../_errors/AppError.js";
import {
	makeRequest,
	makeResponse,
	mockAuth,
	mockService,
	silenceConsoleError,
} from "./_test-utils.js";

const authMock = mockAuth("user-123");
const service = mockService("../_services/transactions.service.js", {
	listUserTransactions: async () => [
		{ id: "tx-1", amount: "-12.50", description: "Coffee", accountId: "acc-1" },
	],
	createUserTransaction: async () => ({
		id: "tx-new",
		amount: "-5.00",
		description: "Lunch",
		accountId: "acc-1",
	}),
	updateUserTransaction: async () => ({ id: "tx-1", amount: "-15.00" }),
	deleteUserTransaction: async () => undefined,
	processDueRecurringTransactions: async () => ({
		created: [{ id: "tx-occ" }],
		completed: 1,
	}),
});
const { default: handler } = await import("./transactions.routes.js");

describe("transactions route", () => {
	test("401 when not authenticated", async () => {
		authMock.mockImplementation(() => Promise.resolve(null));
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toEqual({ error: "Unauthorized" });
	});

	describe("POST process-recurring action", () => {
		test("materializes due recurring occurrences for the user", async () => {
			authMock.mockImplementation(() => Promise.resolve("user-123"));
			const { res, captured } = makeResponse();
			await handler(
				makeRequest({
					method: "POST",
					query: { action: "process-recurring" },
					body: {},
				}),
				res,
			);
			expect(captured.statusCode).toBe(200);
			expect(captured.body).toEqual({
				created: [{ id: "tx-occ" }],
				completed: 1,
			});
			expect(service.processDueRecurringTransactions).toHaveBeenCalledWith(
				"user-123",
			);
		});
	});

	test("GET lists transactions and passes query filters", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ query: { limit: "10", since: "2026-08-01" } }),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			transactions: [
				{
					id: "tx-1",
					amount: "-12.50",
					description: "Coffee",
					accountId: "acc-1",
				},
			],
		});
		expect(service.listUserTransactions).toHaveBeenCalledWith("user-123", {
			limit: "10",
			since: "2026-08-01",
		});
	});

	test("POST creates a transaction with 201", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				body: { amount: "-5", description: "Lunch" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(201);
		expect(captured.body).toEqual({
			transaction: {
				id: "tx-new",
				amount: "-5.00",
				description: "Lunch",
				accountId: "acc-1",
			},
		});
	});

	test("PUT with id updates the transaction", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "PUT",
				query: { id: "tx-1" },
				body: { amount: "-15" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			transaction: { id: "tx-1", amount: "-15.00" },
		});
	});

	test("DELETE with id deletes and returns ok", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "DELETE", query: { id: "tx-1" } }),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ ok: true });
	});

	test("400 maps validation errors from the service", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.createUserTransaction.mockImplementation(() =>
			Promise.reject(new ValidationError("Amount must be a valid number")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "POST", body: { amount: "abc" } }),
			res,
		);
		restore();
		expect(captured.statusCode).toBe(400);
		expect(captured.body).toEqual({ error: "Amount must be a valid number" });
	});

	test("404 maps NotFoundError on update of a missing transaction", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.updateUserTransaction.mockImplementation(() =>
			Promise.reject(new NotFoundError("Transaction not found")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "PUT", query: { id: "missing" }, body: {} }),
			res,
		);
		restore();
		expect(captured.statusCode).toBe(404);
		expect(captured.body).toEqual({ error: "Transaction not found" });
	});

	test("500 maps unexpected failures to a generic message", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.listUserTransactions.mockImplementation(() =>
			Promise.reject(new Error("db exploded")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		restore();
		expect(captured.statusCode).toBe(500);
		expect(captured.body).toEqual({ error: "Server error" });
		expect(JSON.stringify(captured.body)).not.toContain("db exploded");
	});

	test("405 for unsupported method on the collection", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "PATCH" }), res);
		expect(captured.statusCode).toBe(405);
		expect(captured.body).toEqual({ error: "Method not allowed" });
	});

	test("405 for unsupported method on a single resource", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "POST", query: { id: "tx-1" } }), res);
		expect(captured.statusCode).toBe(405);
		expect(captured.body).toEqual({ error: "Method not allowed" });
	});
});
