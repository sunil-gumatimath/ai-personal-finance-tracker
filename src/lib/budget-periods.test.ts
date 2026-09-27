import { describe, expect, it } from "bun:test";
import {
	PERIOD_TO_MONTHLY,
	budgetProgressPercent,
	budgetStatus,
	toMonthlyEquivalent,
	OVER_BUDGET_PERCENT,
	APPROACHING_BUDGET_PERCENT,
} from "./budget-periods";

describe("period normalisation", () => {
	it("scales each period to a monthly equivalent", () => {
		expect(toMonthlyEquivalent(1000, "monthly")).toBe(1000);
		expect(toMonthlyEquivalent(1000, "weekly")).toBeCloseTo(4333.33, 1);
		expect(toMonthlyEquivalent(12000, "yearly")).toBe(1000);
	});

	it("passes the amount through for an unknown period", () => {
		// Guards the `amount * undefined -> NaN` trap: `??` binds looser than
		// `*`, so a naive version of this returned NaN.
		expect(
			toMonthlyEquivalent(500, "fortnightly" as never),
		).toBe(500);
		expect(Number.isNaN(toMonthlyEquivalent(500, "fortnightly" as never))).toBe(
			false,
		);
	});

	it("keeps the multiplier table aligned with the period names", () => {
		expect(Object.keys(PERIOD_TO_MONTHLY).sort()).toEqual([
			"monthly",
			"weekly",
			"yearly",
		]);
	});
});

describe("budgetProgressPercent", () => {
	it("computes a real percentage when a limit exists", () => {
		expect(budgetProgressPercent(50, 100)).toBe(50);
		expect(budgetProgressPercent(150, 100)).toBe(150);
	});

	it("returns a defined value for a zero limit", () => {
		// The old inline idiom invented a synthetic 101%, which was then
		// rendered as if it were a real measurement.
		expect(budgetProgressPercent(5, 0)).toBe(101);
		expect(budgetProgressPercent(0, 0)).toBe(0);
	});
});

describe("budgetStatus", () => {
	it("treats exactly 100% as over budget", () => {
		// The Budgets page used a strict `>` while the digest and notifications
		// used `>=`, so at exactly 100% the page said "On track" and the AI
		// summary said "over budget". One threshold now.
		expect(budgetStatus(OVER_BUDGET_PERCENT)).toBe("over");
		expect(budgetStatus(OVER_BUDGET_PERCENT - 0.1)).toBe("warning");
	});

	it("treats 80% as approaching", () => {
		expect(budgetStatus(APPROACHING_BUDGET_PERCENT)).toBe("warning");
		expect(budgetStatus(APPROACHING_BUDGET_PERCENT - 0.1)).toBe("ok");
		expect(budgetStatus(0)).toBe("ok");
	});
});
