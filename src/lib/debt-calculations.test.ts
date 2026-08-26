import { describe, it, expect } from "bun:test";
import {
	buildSimulations,
	buildStrategies,
	calculatePayoffTime,
	calculateTotalInterest,
	getProgress,
} from "./debt-calculations";
import type { Debt } from "@/types";

function makeDebt(overrides: Partial<Debt>): Debt {
	return {
		id: overrides.id ?? "debt-1",
		user_id: "user-1",
		name: overrides.name ?? "Test Debt",
		type: overrides.type ?? "credit_card",
		original_amount: overrides.original_amount ?? 1000,
		current_balance: overrides.current_balance ?? 1000,
		interest_rate: overrides.interest_rate ?? 0,
		minimum_payment: overrides.minimum_payment ?? 50,
		due_day: null,
		start_date: "2026-01-01",
		end_date: null,
		lender: null,
		notes: null,
		color: "#ef4444",
		icon: "credit_card",
		is_active: overrides.is_active ?? true,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
	};
}

describe("calculatePayoffTime", () => {
	it("computes a known zero-interest amortization", () => {
		const debt = makeDebt({
			current_balance: 1200,
			minimum_payment: 100,
			interest_rate: 0,
		});
		expect(calculatePayoffTime(debt)).toBe(12);
	});

	it("rounds up on an amortizing balance with interest", () => {
		// balance 1000 @ 12% APR (monthly 1%) with $100/month:
		// months = ln(100 / (100 - 1000*0.01)) / ln(1.01) ≈ 10.59 → 11
		const debt = makeDebt({
			current_balance: 1000,
			minimum_payment: 100,
			interest_rate: 12,
		});
		expect(calculatePayoffTime(debt)).toBe(11);
	});

	it("returns null when the minimum payment cannot cover monthly interest", () => {
		// 1000 @ 24% APR accrues $20/month; a $10 minimum grows the balance forever
		const debt = makeDebt({
			current_balance: 1000,
			minimum_payment: 10,
			interest_rate: 24,
		});
		expect(calculatePayoffTime(debt)).toBe(null);
	});

	it("returns null for already-paid-off or payment-less debts", () => {
		expect(
			calculatePayoffTime(makeDebt({ current_balance: 0 })),
		).toBe(null);
		expect(
			calculatePayoffTime(makeDebt({ minimum_payment: 0 })),
		).toBe(null);
	});
});

describe("calculateTotalInterest", () => {
	it("uses the ceil-rounded lifetime (totalPaid minus principal)", () => {
		// From the case above: 11 months × $100 = $1100 paid → $100 interest.
		const debt = makeDebt({
			current_balance: 1000,
			minimum_payment: 100,
			interest_rate: 12,
		});
		expect(calculateTotalInterest(debt)).toBe(100);
	});

	it("returns 0 when the debt never pays off", () => {
		const debt = makeDebt({
			current_balance: 1000,
			minimum_payment: 10,
			interest_rate: 24,
		});
		expect(calculateTotalInterest(debt)).toBe(0);
	});
});

describe("getProgress", () => {
	it("computes percent paid", () => {
		expect(
			getProgress(makeDebt({ original_amount: 200, current_balance: 150 })),
		).toBe(25);
	});

	it("clamps to 0..100", () => {
		// Negative equity (balance grew past the original amount)
		expect(
			getProgress(makeDebt({ original_amount: 100, current_balance: 150 })),
		).toBe(0);
		expect(getProgress(makeDebt({ original_amount: 100, current_balance: 0 }))).toBe(
			100,
		);
		expect(getProgress(makeDebt({ original_amount: 0 }))).toBe(100);
	});
});

describe("buildStrategies weighted APR", () => {
	it("weights the average APR by outstanding balance", () => {
		const big = makeDebt({
			id: "big",
			current_balance: 3000,
			original_amount: 6000,
			interest_rate: 20,
			minimum_payment: 100,
		});
		const small = makeDebt({
			id: "small",
			current_balance: 1000,
			original_amount: 2000,
			interest_rate: 5,
			minimum_payment: 50,
		});
		const strategies = buildStrategies([big, small]);

		// (3000×20 + 1000×5) / 4000 = 16.25 — a plain mean (12.5) would lie.
		expect(strategies.avgInterestRate).toBeCloseTo(16.25, 10);
		expect(strategies.totalDebt).toBe(4000);

		// Snowball: smallest balance first. Avalanche: highest rate first.
		expect(strategies.snowballStrategy.map((d) => d.id)).toEqual([
			"small",
			"big",
		]);
		expect(strategies.avalancheStrategy.map((d) => d.id)).toEqual([
			"big",
			"small",
		]);
	});

	it("falls back gracefully when nothing is active", () => {
		const paidOff = makeDebt({
			current_balance: 0,
			is_active: false,
			interest_rate: 15,
		});
		const strategies = buildStrategies([paidOff]);
		expect(strategies.avgInterestRate).toBe(0);
		expect(strategies.activeDebts).toHaveLength(0);
	});
});

describe("buildSimulations", () => {
	it("rolls completed minimums into the next target under snowball", () => {
		// Two zero-interest debts, $50 minimums each, no extra payment.
		// Minimums alone take 4 months (the larger debt clears last); with
		// rollover the freed-up minimum finishes it in month 3.
		const small = makeDebt({
			id: "small",
			name: "Small Card",
			current_balance: 100,
			original_amount: 100,
			minimum_payment: 50,
			interest_rate: 0,
		});
		const large = makeDebt({
			id: "large",
			name: "Big Loan",
			current_balance: 200,
			original_amount: 200,
			minimum_payment: 50,
			interest_rate: 0,
		});

		const sims = buildSimulations([large, small], 0);

		expect(sims.snowball.months).toBe(3);
		const finalPoint = sims.snowball.monthlyData.at(-1);
		expect(finalPoint?.remainingBalance).toBe(0);
		expect(sims.snowball.totalInterest).toBe(0);

		// Minimums-only takes the full 4 months without rollover
		expect(sims.minimums.months).toBe(4);
	});

	it("handles zero-interest debts without dividing by zero", () => {
		const debt = makeDebt({
			current_balance: 300,
			minimum_payment: 100,
			interest_rate: 0,
		});
		const sims = buildSimulations([debt], 0);
		expect(sims.snowball.months).toBe(3);
		expect(sims.avalanche.totalInterest).toBe(0);
	});

	it("flags minimums-only simulations that never pay off", () => {
		// $10/month against $20/month of accrued interest → infinite payoff.
		const stuck = makeDebt({
			id: "stuck",
			current_balance: 1000,
			minimum_payment: 10,
			interest_rate: 24,
		});
		const sims = buildSimulations([stuck], 0);

		expect(sims.minimums.neverPayoff).toBe(true);
		expect(sims.minimums.months).toBe(Number.POSITIVE_INFINITY);

		// Boundary: a minimum exactly equal to the interest still never
		// reduces the principal.
		const treadingWater = makeDebt({
			id: "tread",
			current_balance: 1000,
			minimum_payment: 20,
			interest_rate: 24,
		});
		expect(buildSimulations([treadingWater], 0).minimums.neverPayoff).toBe(
			true,
		);

		// A healthy minimum is NOT flagged.
		const healthy = makeDebt({
			id: "healthy",
			current_balance: 1000,
			minimum_payment: 50,
			interest_rate: 24,
		});
		const healthySims = buildSimulations([healthy], 0);
		expect(healthySims.minimums.neverPayoff ?? false).toBe(false);
		expect(Number.isFinite(healthySims.minimums.months)).toBe(true);
	});

	it("returns empty simulations when there are no active debts", () => {
		const sims = buildSimulations([], 0);
		expect(sims.mergedData).toHaveLength(0);
		expect(sims.snowball.months).toBe(0);
	});

	it("holds the minimums series flat (never zero) when minimums never pay off", () => {
		// Stuck debt: $10/month vs $20/month of interest → neverPayoff.
		// The healthy companion debt finishes fast, so the shared chart horizon
		// comes from snowball/avalanche — the gray "Minimums Only" area must
		// hold at the outstanding balance for every rendered month instead of
		// plummeting to zero (which would visually claim instant payoff).
		const stuck = makeDebt({
			id: "stuck",
			name: "Stuck Card",
			current_balance: 1000,
			original_amount: 1000,
			minimum_payment: 10,
			interest_rate: 24,
		});
		const healthy = makeDebt({
			id: "healthy",
			name: "Healthy Card",
			current_balance: 100,
			original_amount: 100,
			minimum_payment: 50,
			interest_rate: 0,
		});

		const sims = buildSimulations([stuck, healthy], 0);

		expect(sims.minimums.neverPayoff).toBe(true);
		expect(sims.mergedData.length).toBeGreaterThan(1);

		// Opening month shows the full combined balance...
		expect(sims.mergedData[0].minimums).toBe(1100);
		// ...and every later month still owes money on the minimums path.
		for (const row of sims.mergedData) {
			expect(row.minimums).toBe(1100);
		}

		// Control: a paying minimums series still drops to 0 after its horizon
		// (the debt genuinely IS paid) — fill-forward must not apply there.
		const paying = buildSimulations([healthy], 0);
		expect(paying.minimums.neverPayoff ?? false).toBe(false);
		const afterPayoff =
			paying.mergedData[paying.snowball.monthlyData.length - 1];
		expect(afterPayoff?.minimums).toBe(0);
	});
});
