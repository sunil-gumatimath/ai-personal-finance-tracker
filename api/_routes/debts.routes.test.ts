import { describe, expect, test } from "bun:test";
import {
	makeRequest,
	makeResponse,
	mockAuth,
	mockService,
	silenceConsoleError,
} from "./_test-utils.js";

const authMock = mockAuth("user-123");
const service = mockService("../_services/debts.service.js", {
	listUserDebts: async () => [
		{ id: "debt-1", name: "Credit Card", balance: "500.00", apr: "18.5" },
	],
	createUserDebt: async () => ({
		id: "debt-new",
		name: "Loan",
		balance: "1000.00",
	}),
	updateUserDebt: async () => ({
		id: "debt-1",
		name: "Credit Card",
		balance: "450.00",
	}),
	deleteUserDebt: async () => undefined,
	listUserDebtPayments: async () => [
		{
			id: "pay-1",
			debtId: "debt-1",
			amount: "50.00",
			principal: "40.00",
			interest: "10.00",
		},
	],
	createUserDebtPayment: async () => ({
		id: "pay-new",
		debtId: "debt-1",
		amount: "75.00",
	}),
});
const { default: handler } = await import("./debts.routes.js");

describe("debts route", () => {
	test("401 when not authenticated", async () => {
		authMock.mockImplementation(() => Promise.resolve(null));
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toEqual({ error: "Unauthorized" });
	});

	test("GET lists debts", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			debts: [
				{ id: "debt-1", name: "Credit Card", balance: "500.00", apr: "18.5" },
			],
		});
	});

	test("POST creates a debt with 201", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "POST", body: { name: "Loan" } }), res);
		expect(captured.statusCode).toBe(201);
		expect(captured.body).toEqual({
			debt: { id: "debt-new", name: "Loan", balance: "1000.00" },
		});
	});

	test("PUT with id updates the debt", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "PUT",
				query: { id: "debt-1" },
				body: { balance: "450" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			debt: { id: "debt-1", name: "Credit Card", balance: "450.00" },
		});
	});

	test("DELETE with id deletes and returns ok", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ method: "DELETE", query: { id: "debt-1" } }),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ ok: true });
	});

	test("GET action=payments requires debtId", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest({ query: { action: "payments" } }), res);
		expect(captured.statusCode).toBe(400);
		expect(captured.body).toEqual({ error: "Missing debtId" });
	});

	test("GET action=payments lists payments for a debt", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({ query: { action: "payments", debtId: "debt-1" } }),
			res,
		);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			payments: [
				{
					id: "pay-1",
					debtId: "debt-1",
					amount: "50.00",
					principal: "40.00",
					interest: "10.00",
				},
			],
		});
		expect(service.listUserDebtPayments).toHaveBeenCalledWith(
			"user-123",
			"debt-1",
		);
	});

	test("POST action=payments records a payment with 201", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(
			makeRequest({
				method: "POST",
				query: { action: "payments" },
				body: { debtId: "debt-1", amount: "75" },
			}),
			res,
		);
		expect(captured.statusCode).toBe(201);
		expect(captured.body).toEqual({
			payment: { id: "pay-new", debtId: "debt-1", amount: "75.00" },
		});
	});

	test("500 maps unexpected failures to a generic message", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		service.listUserDebts.mockImplementation(() =>
			Promise.reject(new Error("boom")),
		);
		const restore = silenceConsoleError();
		const { res, captured } = makeResponse();
		await handler(makeRequest(), res);
		restore();
		expect(captured.statusCode).toBe(500);
		expect(captured.body).toEqual({ error: "Server error" });
		expect(JSON.stringify(captured.body)).not.toContain("boom");
	});

	test("405 for unsupported method", async () => {
		authMock.mockImplementation(() => Promise.resolve("user-123"));
		const { res, captured } = makeResponse();
		await handler(makeRequest({ method: "PATCH" }), res);
		expect(captured.statusCode).toBe(405);
		expect(captured.body).toEqual({ error: "Method not allowed" });
	});
});
