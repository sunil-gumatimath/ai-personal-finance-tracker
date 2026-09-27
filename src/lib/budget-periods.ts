/**
 * Budget period arithmetic shared by every surface that aggregates across
 * budgets of mixed periods.
 *
 * This lived inline in `pages/Budgets.tsx`, which meant the Dashboard's
 * financial-health score had no way to reach it and summed raw `amount` values
 * instead — so the same user saw one "total budgeted" on the Budgets page and a
 * different one on the health card, differing by up to 4.3× for weekly budgets.
 */

export type BudgetPeriodName = "weekly" | "monthly" | "yearly";

/**
 * Monthly-equivalent multiplier so mixed-period budgets sum honestly.
 *
 * NOTE: this normalises a *rate* (a limit per period), which is correct for
 * `amount`. Applying it to `spent` — a period-to-date partial — is only an
 * approximation: on day 3 of a 7-day week a weekly budget contributes a full
 * week's equivalent limit but only 3/7 of its actual spend. The aggregate
 * percentage therefore still shifts with the day of the week for weekly
 * budgets. Per-card progress is unaffected, since those compare like with like.
 */
export const PERIOD_TO_MONTHLY: Record<BudgetPeriodName, number> = {
	weekly: 52 / 12,
	monthly: 1,
	yearly: 1 / 12,
};

/** Convert any period's amount to its monthly-equivalent value. */
export function toMonthlyEquivalent(
	amount: number,
	period: BudgetPeriodName,
): number {
	const factor = PERIOD_TO_MONTHLY[period];
	// Unknown period (a row written before an option existed): treat the amount
	// as already monthly-equivalent rather than multiplying by NaN.
	return factor === undefined ? amount : amount * factor;
}

/**
 * Progress percentage with a defined answer for a zero limit.
 *
 * A ₹5 expense against a ₹0 limit is 101%, not Infinity and not a divide by
 * zero — callers used to inline this idiom and one of them formatted the
 * synthetic 101 as if it were a real measurement.
 */
export function budgetProgressPercent(spent: number, limit: number): number {
	if (limit > 0) return (spent / limit) * 100;
	return spent > 0 ? 101 : 0;
}

/**
 * The single overspend threshold, shared so the Budgets page, the AI digest
 * and notifications cannot disagree.
 *
 * The Budgets page used a strict `>` while the other two used `>=`, so at
 * exactly 100% the page said "On track" and the digest said "over budget".
 */
export const OVER_BUDGET_PERCENT = 100;
export const APPROACHING_BUDGET_PERCENT = 80;

export type BudgetStatus = "ok" | "warning" | "over";

export function budgetStatus(percent: number): BudgetStatus {
	if (percent >= OVER_BUDGET_PERCENT) return "over";
	if (percent >= APPROACHING_BUDGET_PERCENT) return "warning";
	return "ok";
}
