import { describe, expect, test } from "bun:test";
import {
	parseDigestJson,
	renderDigestMarkdown,
	type DigestStats,
} from "./ai-digest";

const money = (n: number) =>
	`$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const stats: DigestStats = {
	income: 5000,
	expenses: 730,
	net: 4270,
	incomeCount: 2,
	expenseCount: 5,
	topCategories: [
		{ name: "Food", amount: 400, percent: 54.8 },
		{ name: "Transport", amount: 200, percent: 27.4 },
	],
	budgets: [
		{
			category: "Food",
			spent: 400,
			limit: 500,
			percent: 80,
			status: "at risk",
		},
	],
	goals: [{ name: "Vacation", current: 2000, target: 10000, percent: 20 }],
	debts: [{ name: "Car loan", balance: 8000, rate: 5 }],
	money,
};

describe("parseDigestJson", () => {
	test("parses a well-formed prose payload", () => {
		const parsed = parseDigestJson(
			JSON.stringify({
				review: "A solid week.",
				observation: "Food dominates.",
				tip: "Cook at home more.",
				goal_callouts: ["Good progress"],
				debt_callouts: ["Refinancing possible"],
			}),
		);
		expect(parsed).toEqual({
			review: "A solid week.",
			observation: "Food dominates.",
			tip: "Cook at home more.",
			goal_callouts: ["Good progress"],
			debt_callouts: ["Refinancing possible"],
		});
	});

	test("strips code fences and trailing text", () => {
		const parsed = parseDigestJson(
			'```json\n{"review": "Hi", "tip": "Save"}\n```',
		);
		expect(parsed?.review).toBe("Hi");
	});

	test("clamps long prose and drops digits from callouts", () => {
		const parsed = parseDigestJson(
			JSON.stringify({
				review: "x".repeat(500),
				tip: "tip",
				goal_callouts: ["Saved $500 extra this month", "Second"],
			}),
		);
		expect(parsed?.review.length).toBeLessThanOrEqual(240);
		expect(parsed?.goal_callouts[0]).not.toMatch(/\d/);
		expect(parsed?.goal_callouts[1]).toBe("Second");
	});

	test("returns null for unusable payloads", () => {
		expect(parseDigestJson("")).toBeNull();
		expect(parseDigestJson("not json")).toBeNull();
		expect(parseDigestJson('{"foo": 1}')).toBeNull();
		expect(parseDigestJson("[1,2,3]")).toBeNull();
	});
});

describe("renderDigestMarkdown", () => {
	test("renders all sections with server-computed numbers", () => {
		const md = renderDigestMarkdown(stats, {
			review: "Steady week with strong savings.",
			observation: "Food is the biggest bucket.",
			tip: "Set a $450 food budget.",
			goal_callouts: ["Keep saving"],
			debt_callouts: [],
		});

		expect(md).toContain("## At a Glance");
		expect(md).toContain("- **Income:** $5,000.00 (2 transactions)");
		expect(md).toContain("- **Net:** $4,270.00");
		expect(md).toContain("## Week in Review");
		expect(md).toContain("Steady week with strong savings.");
		expect(md).toContain("## Top Spending");
		expect(md).toContain("**Food** — $400.00 (54.8% of spending)");
		expect(md).toContain("Observation: Food is the biggest bucket.");
		expect(md).toContain("## Budget Check");
		expect(md).toContain("$400.00 / $500.00 (80%) — at risk");
		expect(md).toContain("## Goals & Debt");
		expect(md).toContain("$2,000.00 / $10,000.00 (20% complete)");
		expect(md).toContain("$8,000.00 remaining at 5% interest");
		expect(md).toContain("## Tip");
		expect(md).toContain("> Set a $450 food budget.");
	});

	test("omits sections without data and fills neutral prose", () => {
		const md = renderDigestMarkdown(
			{ ...stats, budgets: [], goals: [], debts: [], topCategories: [] },
			{
				review: "",
				observation: "",
				tip: "",
				goal_callouts: [],
				debt_callouts: [],
			},
		);

		expect(md).not.toContain("## Budget Check");
		expect(md).not.toContain("## Goals & Debt");
		expect(md).not.toContain("## Top Spending\n- **");
		expect(md).toContain("This week you earned");
		expect(md).toContain("## Tip\n> Track your spending");
	});

	test("default review uses server numbers when model prose is empty", () => {
		const md = renderDigestMarkdown(stats, {
			review: "",
			observation: "",
			tip: "",
			goal_callouts: [],
			debt_callouts: [],
		});
		expect(md).toContain("you earned $5,000.00 and spent $730.00");
		expect(md).toContain("net savings of $4,270.00");
	});
});
