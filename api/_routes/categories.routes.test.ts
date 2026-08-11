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
const service = mockService("../_services/categories.service.js", {
	listUserCategories: async () => [
		{ id: "cat-1", name: "Groceries", type: "expense", color: "#10b981" },
	],
	createUserCategory: async () => ({
		id: "cat-new",
		name: "Travel",
		type: "expense",
	}),
	updateUserCategory: async () => ({
		id: "cat-1",
		name: "Groceries",
		type: "expense",
	}),
	deleteUserCategory: async () => undefined,
});
const { default: handler } = await import("./categories.routes.js");

describe("categories route", () => {
	test("401 when not authenticated", async () => {
		authMock.mockImplementation(() => Promise.resolve(null));
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toEqual({ error: "Unauthorized" });
	});

	test("GET lists categories and forwards type filter", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest({ query: { type: "expense" } }), res);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			categories: [
				{ id: "cat-1", name: "Groceries", type: "expense", color: "#10b981" },
			],
		});
		expect(service.listUserCategories).toHaveBeenCalledWith(
			"user-123",
			"expense",
		);
	});

	test("POST creates a category with 201", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				body: { name: "Travel", type: "expense" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(201);
		expect(captured.body).toEqual({
			category: { id: "cat-new", name: "Travel", type: "expense" },
		});
	});

	test("PUT with id updates the category", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "PUT",
				query: { id: "cat-1" },
				body: { name: "Groceries" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			category: { id: "cat-1", name: "Groceries", type: "expense" },
		});
	});

	test("DELETE with id deletes and returns ok", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "DELETE", query: { id: "cat-1" } }),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ ok: true });
	});

	test("404 maps NotFoundError for a missing category", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.updateUserCategory.mockImplementation(() =>
			Promise.reject(new NotFoundError("Category not found")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "PUT", query: { id: "missing" }, body: {} }),
			res,
		);
		restore();
		expect(captured.statusCode).toBe(404);
		expect(captured.body).toEqual({ error: "Category not found" });
	});

	test("500 maps unexpected failures to a generic message", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.listUserCategories.mockImplementation(() =>
			Promise.reject(new Error("boom")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		restore();
		expect(captured.statusCode).toBe(500);
		expect(captured.body).toEqual({ error: "Server error" });
	});
});
