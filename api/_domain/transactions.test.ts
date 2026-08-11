import { describe, expect, test } from "bun:test";
import {
	assertPositiveAmount,
	assertUuid,
	computeNextDueDate,
	normalizeTransactionLimit,
	sanitizeRecurringInput,
	validateCreateTransactionInput,
	validateListTransactionsOptions,
} from "./transactions";
import { ValidationError } from "../_errors/AppError";

describe("transaction domain validation", () => {
	test("accepts valid transaction create input", () => {
		expect(() =>
			validateCreateTransactionInput({
				type: "expense",
				amount: 12.34,
			}),
		).not.toThrow();
	});

	test("rejects invalid transaction type", () => {
		expect(() =>
			validateCreateTransactionInput({
				type: "refund",
				amount: 12.34,
			}),
		).toThrow(ValidationError);
	});

	test("rejects non-positive and non-finite amounts", () => {
		expect(() => assertPositiveAmount(0)).toThrow(ValidationError);
		expect(() => assertPositiveAmount(-1)).toThrow(ValidationError);
		expect(() => assertPositiveAmount(Number.NaN)).toThrow(ValidationError);
	});

	test("validates UUID parameters", () => {
		expect(() =>
			assertUuid("550e8400-e29b-41d4-a716-446655440000", "transaction ID"),
		).not.toThrow();
		expect(() => assertUuid("not-a-uuid", "transaction ID")).toThrow(
			ValidationError,
		);
	});

	test("normalizes transaction list limits", () => {
		expect(normalizeTransactionLimit("25")).toBe(25);
		expect(normalizeTransactionLimit("0")).toBeNull();
		expect(normalizeTransactionLimit("1001")).toBeNull();
		expect(normalizeTransactionLimit(undefined)).toBeNull();
	});

	test("rejects invalid since date filters", () => {
		expect(() =>
			validateListTransactionsOptions({ since: "2026-07-07" }),
		).not.toThrow();
		expect(() =>
			validateListTransactionsOptions({ since: "07/07/2026" }),
		).toThrow(ValidationError);
	});
});

describe("computeNextDueDate", () => {
	test("advances daily/weekly/yearly by fixed intervals", () => {
		expect(computeNextDueDate("2026-01-15", "daily")).toBe("2026-01-16");
		expect(computeNextDueDate("2026-01-15", "weekly")).toBe("2026-01-22");
		expect(computeNextDueDate("2024-02-29", "yearly")).toBe("2025-02-28");
	});

	test("monthly keeps the day of month", () => {
		expect(computeNextDueDate("2026-01-15", "monthly")).toBe("2026-02-15");
		expect(computeNextDueDate("2026-03-31", "monthly")).toBe("2026-04-30");
		expect(computeNextDueDate("2026-01-31", "monthly")).toBe("2026-02-28");
	});

	test("rejects malformed dates", () => {
		expect(() => computeNextDueDate("not-a-date", "monthly")).toThrow(
			ValidationError,
		);
		expect(() => computeNextDueDate("2026-02-30", "monthly")).not.toThrow();
	});
});

describe("sanitizeRecurringInput", () => {
	test("computes next_due_date for a new recurring transaction", () => {
		const out = sanitizeRecurringInput({
			type: "expense",
			amount: 12,
			date: "2026-01-15",
			is_recurring: true,
			recurring_frequency: "monthly",
		});
		expect(out.next_due_date).toBe("2026-02-15");
		expect(out.recurring_frequency).toBe("monthly");
	});

	test("strips server-owned fields from client input", () => {
		const out = sanitizeRecurringInput({
			type: "expense",
			amount: 12,
			date: "2026-01-15",
			is_recurring: true,
			recurring_frequency: "monthly",
			next_due_date: "1999-01-01",
			recurring_parent_id: "forged-id",
		});
		expect(out.next_due_date).toBe("2026-02-15");
		expect(out.recurring_parent_id).toBeUndefined();
	});

	test("clears schedule when the recurring flag is turned off", () => {
		const out = sanitizeRecurringInput(
			{ is_recurring: false, recurring_frequency: "weekly" },
			{ is_recurring: true, date: "2026-01-01" },
		);
		expect(out.is_recurring).toBe(false);
		expect(out.recurring_frequency).toBeNull();
		expect(out.recurring_end_date).toBeNull();
		expect(out.next_due_date).toBeNull();
	});

	test("never rewinds an already-advanced series on partial updates", () => {
		const out = sanitizeRecurringInput(
			{ description: "edited" },
			{
				is_recurring: true,
				date: "2026-01-15",
				next_due_date: "2026-05-15",
			},
		);
		expect(out.next_due_date).toBe("2026-05-15");
	});

	test("requires a valid frequency when recurring", () => {
		expect(() =>
			sanitizeRecurringInput({
				type: "expense",
				amount: 12,
				date: "2026-01-15",
				is_recurring: true,
				recurring_frequency: "fortnightly",
			}),
		).toThrow(ValidationError);
	});

	test("validates the end date format and range", () => {
		expect(() =>
			sanitizeRecurringInput({
				type: "expense",
				amount: 12,
				date: "2026-01-15",
				is_recurring: true,
				recurring_frequency: "monthly",
				recurring_end_date: "01/2027",
			}),
		).toThrow(ValidationError);
		expect(() =>
			sanitizeRecurringInput({
				type: "expense",
				amount: 12,
				date: "2026-01-15",
				is_recurring: true,
				recurring_frequency: "monthly",
				recurring_end_date: "2025-12-01",
			}),
		).toThrow(ValidationError);
		expect(() =>
			sanitizeRecurringInput({
				type: "expense",
				amount: 12,
				date: "2026-01-15",
				is_recurring: true,
				recurring_frequency: "monthly",
				recurring_end_date: "2026-06-30",
			}),
		).not.toThrow();
	});
});
