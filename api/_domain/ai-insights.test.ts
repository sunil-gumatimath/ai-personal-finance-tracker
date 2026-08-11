import { describe, expect, test } from "bun:test";
import {
	ANOMALY_LOOKBACK,
	MAX_AI_INSIGHTS,
	MAX_ANOMALIES,
	detectAnomalies,
	getAnomalyThreshold,
	parseAiInsightsJson,
	type AnomalyCandidate,
} from "./ai-insights";

const fmt = (n: number) => `$${n.toFixed(2)}`;

function tx(
	amount: number,
	overrides: Partial<AnomalyCandidate> = {},
): AnomalyCandidate {
	return {
		type: "expense",
		amount,
		description: `tx-${amount}`,
		date: "2026-01-01",
		categoryName: "Food",
		...overrides,
	};
}

describe("parseAiInsightsJson", () => {
	test("parses a valid { insights: [...] } object", () => {
		const raw = JSON.stringify({
			insights: [
				{
					type: "coaching",
					title: "Spend less",
					description: "Try budgeting.",
				},
				{ type: "kudo", title: "Great month", description: "Savings up 20%." },
			],
		});
		expect(parseAiInsightsJson(raw)).toEqual([
			{ type: "coaching", title: "Spend less", description: "Try budgeting." },
			{ type: "kudo", title: "Great month", description: "Savings up 20%." },
		]);
	});

	test("parses a bare array and strips markdown fences", () => {
		const raw =
			'```json\n[{"type": "coaching", "title": "T", "description": "D"}]\n```';
		expect(parseAiInsightsJson(raw)).toEqual([
			{ type: "coaching", title: "T", description: "D" },
		]);
	});

	test("rejects junk, non-objects, and missing fields", () => {
		expect(parseAiInsightsJson("not json at all")).toEqual([]);
		expect(parseAiInsightsJson("")).toEqual([]);
		expect(parseAiInsightsJson("```\n42\n```")).toEqual([]);
		expect(
			parseAiInsightsJson(JSON.stringify({ insights: [{ title: "no type" }] })),
		).toEqual([]);
		expect(
			parseAiInsightsJson(
				JSON.stringify({ insights: [{ type: "coaching", title: " " }] }),
			),
		).toEqual([]);
		expect(parseAiInsightsJson(JSON.stringify({ insights: "nope" }))).toEqual(
			[],
		);
		expect(
			parseAiInsightsJson(JSON.stringify({ insights: [null, 7, "x"] })),
		).toEqual([]);
	});

	test("drops unexpected types (e.g. anomaly) instead of coercing them", () => {
		const raw = JSON.stringify({
			insights: [
				{ type: "anomaly", title: "Weird", description: "Should be dropped" },
				{ type: "coaching", title: "OK", description: "Kept" },
			],
		});
		expect(parseAiInsightsJson(raw)).toEqual([
			{ type: "coaching", title: "OK", description: "Kept" },
		]);
	});

	test("caps the number of insights and trims long fields", () => {
		const many = Array.from({ length: 20 }, (_, i) => ({
			type: "coaching",
			title: `T${i}`,
			description: "d",
		}));
		const parsed = parseAiInsightsJson(JSON.stringify({ insights: many }));
		expect(parsed).toHaveLength(MAX_AI_INSIGHTS);

		const long = parseAiInsightsJson(
			JSON.stringify({
				insights: [
					{
						type: "kudo",
						title: "x".repeat(500),
						description: "y".repeat(2000),
					},
				],
			}),
		);
		expect(long[0].title).toHaveLength(200);
		expect(long[0].description).toHaveLength(1000);
	});
});

describe("getAnomalyThreshold", () => {
	test("scales with currency and falls back for unknown ones", () => {
		expect(getAnomalyThreshold("USD")).toBe(50);
		expect(getAnomalyThreshold("JPY")).toBe(5000);
		expect(getAnomalyThreshold("INR")).toBe(500);
		expect(getAnomalyThreshold("XYZ")).toBe(50);
	});
});

describe("detectAnomalies", () => {
	test("flags a transaction above 1.8x the category average and above the floor", () => {
		const rows = [
			tx(100), // average contributor
			tx(120),
			tx(80),
			tx(500), // 500 > 100*1.8=180 and > 50 → anomaly
		];
		const anomalies = detectAnomalies(rows, "USD", fmt);
		expect(anomalies).toHaveLength(1);
		expect(anomalies[0]).toMatchObject({
			type: "anomaly",
			title: "Unusual Spending",
			category: "Food",
			amount: 500,
		});
		expect(anomalies[0].description).toContain("$500.00");
	});

	test("respects the currency floor (JPY: 5000)", () => {
		const rows = [
			tx(1000),
			tx(1100),
			tx(900),
			tx(3000), // 3000 > 1800 but < 5000 → NOT an anomaly in JPY
		];
		expect(detectAnomalies(rows, "JPY", fmt)).toHaveLength(0);
		expect(detectAnomalies(rows, "USD", fmt)).toHaveLength(1);
	});

	test("only inspects the N most recent transactions per category", () => {
		const many = Array.from({ length: ANOMALY_LOOKBACK + 5 }, (_, i) =>
			tx(100, { date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}` }),
		);
		// A huge transaction just outside the lookback window is not flagged.
		many[ANOMALY_LOOKBACK] = tx(5000, { date: "2025-01-01" });
		const anomalies = detectAnomalies(many, "USD", fmt);
		expect(anomalies.some((a) => a.amount === 5000)).toBe(false);
	});

	test("caps total anomalies and handles uncategorized expenses", () => {
		const rows: AnomalyCandidate[] = [];
		for (let i = 0; i < MAX_ANOMALIES + 3; i++) {
			// One category each (a normal + a spike) so every category yields an
			// anomaly and the global cap is what bounds the result.
			rows.push(tx(100, { categoryName: `Cat${i}` }));
			rows.push(tx(1000, { categoryName: `Cat${i}` }));
		}
		const anomalies = detectAnomalies(rows, "USD", fmt);
		expect(anomalies).toHaveLength(MAX_ANOMALIES);

		const uncategorized = detectAnomalies(
			[tx(100, { categoryName: null }), tx(1000, { categoryName: null })],
			"USD",
			fmt,
		);
		expect(uncategorized[0].category).toBe("Uncategorized");
	});
});
