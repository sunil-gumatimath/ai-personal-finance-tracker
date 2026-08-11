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
const service = mockService("../_services/goals.service.js", {
	listUserGoals: async () => [
		{ id: "g-1", name: "Emergency Fund", target: "10000.00" },
	],
	createUserGoal: async () => ({
		id: "g-new",
		name: "Vacation",
		target: "2000.00",
	}),
	updateUserGoal: async () => ({
		id: "g-1",
		name: "Emergency Fund",
		target: "12000.00",
	}),
	deleteUserGoal: async () => undefined,
});
const { default: handler } = await import("./goals.routes.js");

describe("goals route", () => {
	test("401 when not authenticated", async () => {
		authMock.mockImplementation(() => Promise.resolve(null));
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toEqual({ error: "Unauthorized" });
	});

	test("GET lists goals", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			goals: [{ id: "g-1", name: "Emergency Fund", target: "10000.00" }],
		});
	});

	test("POST creates a goal with 201", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				body: { name: "Vacation", target: "2000" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(201);
		expect(captured.body).toEqual({
			goal: { id: "g-new", name: "Vacation", target: "2000.00" },
		});
	});

	test("PUT with id updates the goal", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "PUT",
				query: { id: "g-1" },
				body: { target: "12000" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			goal: { id: "g-1", name: "Emergency Fund", target: "12000.00" },
		});
	});

	test("DELETE with id deletes and returns ok", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "DELETE", query: { id: "g-1" } }), res);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ ok: true });
	});

	test("404 maps NotFoundError for a missing goal", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.updateUserGoal.mockImplementation(() =>
			Promise.reject(new NotFoundError("Goal not found")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "PUT", query: { id: "missing" }, body: {} }),
			res,
		);
		restore();
		expect(captured.statusCode).toBe(404);
		expect(captured.body).toEqual({ error: "Goal not found" });
	});

	test("500 maps unexpected failures to a generic message", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.listUserGoals.mockImplementation(() =>
			Promise.reject(new Error("db down")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		restore();
		expect(captured.statusCode).toBe(500);
		expect(captured.body).toEqual({ error: "Server error" });
	});
});
