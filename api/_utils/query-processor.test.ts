import { describe, expect, test } from "bun:test";
import { AIQueryProcessor } from "./query-processor";

describe("AIQueryProcessor", () => {
	describe("determineIntent", () => {
		test("detects each intent type", () => {
			expect(
				AIQueryProcessor.determineIntent("compare my spending vs last month")
					.type,
			).toBe("comparison");
			expect(
				AIQueryProcessor.determineIntent("forecast next month spending").type,
			).toBe("forecast");
			expect(
				AIQueryProcessor.determineIntent("how much did I earn this month").type,
			).toBe("income");
			expect(
				AIQueryProcessor.determineIntent("how much debt do I have").type,
			).toBe("debt");
			expect(
				AIQueryProcessor.determineIntent("what is my account balance").type,
			).toBe("balance");
			expect(
				AIQueryProcessor.determineIntent("how much did I spend on food").type,
			).toBe("spending");
			expect(AIQueryProcessor.determineIntent("am I over my budget").type).toBe(
				"budget",
			);
			expect(
				AIQueryProcessor.determineIntent("am I on track with my savings goal")
					.type,
			).toBe("goals");
		});

		test("falls back to general with low confidence", () => {
			const result = AIQueryProcessor.determineIntent("hello there friend");
			expect(result.type).toBe("general");
			expect(result.confidence).toBe(0.3);
		});
	});

	describe("extractTimeframe", () => {
		test("detects named timeframes", () => {
			expect(AIQueryProcessor.extractTimeframe("spent today")).toBe("today");
			expect(AIQueryProcessor.extractTimeframe("this week")).toBe("week");
			expect(AIQueryProcessor.extractTimeframe("last month")).toBe(
				"last_month",
			);
			expect(AIQueryProcessor.extractTimeframe("this quarter")).toBe("quarter");
			expect(AIQueryProcessor.extractTimeframe("this year")).toBe("year");
			expect(AIQueryProcessor.extractTimeframe("all time")).toBe("all");
		});

		test("returns undefined when no timeframe is mentioned", () => {
			expect(
				AIQueryProcessor.extractTimeframe("how is my savings"),
			).toBeUndefined();
		});
	});

	describe("extractCustomDate", () => {
		test("parses ISO dates", () => {
			expect(AIQueryProcessor.extractCustomDate("spending on 2024-12-05")).toBe(
				"2024-12-05",
			);
		});

		test("parses slash dates as MM/DD/YYYY", () => {
			expect(AIQueryProcessor.extractCustomDate("spending on 12/05/2024")).toBe(
				"2024-12-05",
			);
			expect(AIQueryProcessor.extractCustomDate("spending on 3/7/2024")).toBe(
				"2024-03-07",
			);
		});

		test("rejects impossible dates", () => {
			expect(
				AIQueryProcessor.extractCustomDate("on 13/45/2024"),
			).toBeUndefined();
			expect(
				AIQueryProcessor.extractCustomDate("on 02/30/2024"),
			).toBeUndefined();
			expect(
				AIQueryProcessor.extractCustomDate("on 2024-13-01"),
			).toBeUndefined();
			expect(
				AIQueryProcessor.extractCustomDate("no date here"),
			).toBeUndefined();
		});
	});

	describe("extractCategories / extractOperation / extractComparison", () => {
		test("extracts categories", () => {
			expect(
				AIQueryProcessor.extractCategories("spent on food and transport"),
			).toEqual(["food", "transport"]);
		});

		test("extracts operations", () => {
			expect(AIQueryProcessor.extractOperation("average spending")).toBe(
				"average",
			);
			expect(AIQueryProcessor.extractOperation("total spending")).toBe("total");
			expect(AIQueryProcessor.extractOperation("breakdown by category")).toBe(
				"breakdown",
			);
		});

		test("extracts comparisons", () => {
			expect(AIQueryProcessor.extractComparison("vs last month")).toBe(
				"last_month",
			);
			expect(AIQueryProcessor.extractComparison("vs last year")).toBe(
				"last_year",
			);
			expect(AIQueryProcessor.extractComparison("against my budget")).toBe(
				"budget",
			);
		});
	});

	describe("processQuery", () => {
		test("wires customDate into the processed intent", () => {
			const processed = AIQueryProcessor.processQuery(
				"how much did I spend on 2024-12-05?",
			);
			expect(processed.intent.timeframe).toBe("custom");
			expect(processed.intent.customDate).toBe("2024-12-05");
		});

		test("produces a suggested response for known intents", () => {
			const processed = AIQueryProcessor.processQuery(
				"what's my account balance?",
			);
			expect(processed.intent.type).toBe("balance");
			expect(processed.suggestedResponse).toContain("balance");
		});
	});
});
