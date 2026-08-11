import { describe, expect, test } from "bun:test";
import { parseTransactionExtractionJson } from "./ai-parse";

describe("parseTransactionExtractionJson", () => {
	test("parses a well-formed extraction", () => {
		const parsed = parseTransactionExtractionJson(
			JSON.stringify({
				type: "expense",
				amount: 45.5,
				description: "Groceries",
				category_name: "Food",
				account_name: "Checking",
				date: "2026-08-03",
			}),
		);
		expect(parsed).toEqual({
			type: "expense",
			amount: 45.5,
			description: "Groceries",
			date: "2026-08-03",
			category_id: null,
			account_id: null,
			to_account_id: null,
			category_name: "Food",
			account_name: "Checking",
		});
	});

	test("strips markdown code fences", () => {
		const parsed = parseTransactionExtractionJson(
			'```json\n{"type": "income", "amount": 2000, "date": "2026-08-01"}\n```',
		);
		expect(parsed?.type).toBe("income");
		expect(parsed?.amount).toBe(2000);
	});

	test("coerces string amounts with currency symbols", () => {
		const parsed = parseTransactionExtractionJson(
			JSON.stringify({ type: "expense", amount: "$45.50", date: "2026-08-03" }),
		);
		expect(parsed?.amount).toBe(45.5);
	});

	test("rejects negative, zero and non-numeric amounts", () => {
		expect(
			parseTransactionExtractionJson(
				JSON.stringify({ type: "expense", amount: -5, date: "2026-08-03" }),
			),
		).toBeNull();
		expect(
			parseTransactionExtractionJson(
				JSON.stringify({ type: "expense", amount: 0, date: "2026-08-03" }),
			),
		).toBeNull();
		expect(
			parseTransactionExtractionJson(
				JSON.stringify({ type: "expense", amount: "abc", date: "2026-08-03" }),
			),
		).toBeNull();
	});

	test("rejects invalid dates", () => {
		expect(
			parseTransactionExtractionJson(
				JSON.stringify({ type: "expense", amount: 10, date: "08/03/2026" }),
			),
		).toBeNull();
		expect(
			parseTransactionExtractionJson(
				JSON.stringify({ type: "expense", amount: 10, date: "2026-13-01" }),
			),
		).toBeNull();
	});

	test("requires both sides of a transfer", () => {
		expect(
			parseTransactionExtractionJson(
				JSON.stringify({
					type: "transfer",
					amount: 100,
					date: "2026-08-03",
					account_name: "Checking",
				}),
			),
		).toBeNull();
		expect(
			parseTransactionExtractionJson(
				JSON.stringify({
					type: "transfer",
					amount: 100,
					date: "2026-08-03",
					account_name: "Checking",
					to_account_name: "Checking",
				}),
			),
		).toBeNull();
	});

	test("returns null for garbage input", () => {
		expect(parseTransactionExtractionJson("")).toBeNull();
		expect(parseTransactionExtractionJson("not json")).toBeNull();
		expect(parseTransactionExtractionJson('{"amount": 5}')).toBeNull();
		expect(parseTransactionExtractionJson("[1,2,3]")).toBeNull();
	});
});
