import { describe, expect, test } from "bun:test";
import { NotFoundError } from "../_errors/AppError.js";
import {
	makeRequest,
	makeResponse,
	mockAuth,
	mockService,
	silenceConsoleError,
} from "./_test-utils.js";

const authMock = mockAuth("user-123");
const service = mockService("../_services/budgets.service.js", {
	listUserBudgets: async () => [
		{ id: "b-1", categoryId: "cat-1", limit: "500.00" },
	],
	createUserBudget: async () => ({
		id: "b-new",
		categoryId: "cat-1",
		limit: "300.00",
	}),
	updateUserBudget: async () => ({
		id: "b-1",
		categoryId: "cat-1",
		limit: "600.00",
	}),
	deleteUserBudget: async () => undefined,
});
const { default: handler } = await import("./budgets.routes.js");

describe("budgets route", () => {
	test("401 when not authenticated", async () => {
		authMock.mockImplementation(() => Promise.resolve(null));
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toEqual({ error: "Unauthorized" });
	});

	test("GET lists budgets", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			budgets: [{ id: "b-1", categoryId: "cat-1", limit: "500.00" }],
		});
	});

	test("POST creates a budget with 201", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				body: { categoryId: "cat-1", limit: "300" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(201);
		expect(captured.body).toEqual({
			budget: { id: "b-new", categoryId: "cat-1", limit: "300.00" },
		});
	});

	test("PUT with id updates the budget", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "PUT",
				query: { id: "b-1" },
				body: { limit: "600" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			budget: { id: "b-1", categoryId: "cat-1", limit: "600.00" },
		});
	});

	test("DELETE with id deletes and returns ok", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "DELETE", query: { id: "b-1" } }), res);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ ok: true });
	});

	test("404 maps NotFoundError for a missing budget", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.updateUserBudget.mockImplementation(() =>
			Promise.reject(new NotFoundError("Budget not found")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "PUT", query: { id: "missing" }, body: {} }),
			res,
		);
		restore();
		expect(captured.statusCode).toBe(404);
		expect(captured.body).toEqual({ error: "Budget not found" });
	});

	test("500 maps unexpected failures to a generic message", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.listUserBudgets.mockImplementation(() =>
			Promise.reject(new Error("nope")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		restore();
		expect(captured.statusCode).toBe(500);
		expect(captured.body).toEqual({ error: "Server error" });
	});
});
