import { format } from "date-fns";
import type { Debt } from "@/types";
import { toNumber } from "@/lib/number";

// `toNumber` used to be re-exported from here "so existing consumers keep
// working", which gave it two import paths: 16 files used `@/lib/number` and
// 2 used this re-export. That made readers open this file to discover the two
// were the same function. Consumers now import it from its real home.

interface SimulationResult {
	months: number;
	totalInterest: number;
	monthlyData: { month: number; remainingBalance: number }[];
	/**
	 * True when a strategy mathematically cannot repay the balances
	 * (e.g. minimums-only where a payment never covers the monthly interest).
	 * `months` is Infinity in that case; UIs should show a "never pays off" hint.
	 */
	neverPayoff?: boolean;
}

const runSimulation = (
	activeDebtsList: Debt[],
	extraPayment: number,
	strategy: "snowball" | "avalanche" | "minimums",
): SimulationResult => {
	// Normalize DECIMAL-as-string fields once at the boundary so all math
	// below operates on plain numbers.
	const simulatedDebts = activeDebtsList.map((d) => ({
		id: d.id,
		current_balance: toNumber(d.current_balance),
		interest_rate: toNumber(d.interest_rate),
		minimum_payment: toNumber(d.minimum_payment),
	}));

	let currentMonth = 0;
	let totalInterestPaid = 0;
	// Tracked outside the loop so the post-loop "did it actually clear?" check
	// below can see the final balance.
	let remainingBalance = simulatedDebts.reduce(
		(sum, d) => sum + d.current_balance,
		0,
	);
	const monthlyData = [{ month: 0, remainingBalance }];

	const maxMonths = 360; // 30 years cap — NOT a payoff projection

	// Fast path for minimums-only: if any debt's payment never covers its
	// monthly interest, bail immediately rather than iterating 360 times. The
	// authoritative check for every strategy is the post-loop one.
	if (strategy === "minimums") {
		const stuck = simulatedDebts.some(
			(d) =>
				d.current_balance > 0 &&
				d.minimum_payment <= d.current_balance * (d.interest_rate / 100 / 12),
		);
		if (stuck) {
			return {
				months: Infinity,
				totalInterest: Infinity,
				monthlyData,
				neverPayoff: true,
			};
		}
	}

	if (strategy === "snowball") {
		simulatedDebts.sort((a, b) => a.current_balance - b.current_balance);
	} else if (strategy === "avalanche") {
		simulatedDebts.sort((a, b) => b.interest_rate - a.interest_rate);
	}

	const baseMinimums = simulatedDebts.reduce(
		(sum, d) => sum + d.minimum_payment,
		0,
	);

	while (currentMonth < maxMonths) {
		const activeCount = simulatedDebts.filter(
			(d) => d.current_balance > 0,
		).length;
		if (activeCount === 0) break;

		currentMonth++;

		simulatedDebts.forEach((d) => {
			if (d.current_balance > 0) {
				const interest = d.current_balance * (d.interest_rate / 100 / 12);
				d.current_balance += interest;
				totalInterestPaid += interest;
			}
		});

		if (strategy === "minimums") {
			simulatedDebts.forEach((d) => {
				if (d.current_balance > 0) {
					const pay = Math.min(d.current_balance, d.minimum_payment);
					d.current_balance -= pay;
				}
			});
		} else {
			let monthlyPool = baseMinimums + extraPayment;
			let leftoverPool = 0;

			simulatedDebts.forEach((d) => {
				if (d.current_balance > 0) {
					const minDue = d.minimum_payment;
					const pay = Math.min(d.current_balance, minDue);
					d.current_balance -= pay;
					monthlyPool -= pay;

					if (d.current_balance === 0 && pay < minDue) {
						leftoverPool += minDue - pay;
					}
				}
			});

			let extraPool = monthlyPool + leftoverPool;

			for (let i = 0; i < simulatedDebts.length; i++) {
				const d = simulatedDebts[i];
				if (d.current_balance > 0) {
					const pay = Math.min(d.current_balance, extraPool);
					d.current_balance -= pay;
					extraPool -= pay;
					if (extraPool <= 0) break;
				}
			}
		}

		remainingBalance = simulatedDebts.reduce(
			(sum, d) => sum + d.current_balance,
			0,
		);
		monthlyData.push({
			month: currentMonth,
			remainingBalance: Math.round(remainingBalance),
		});

		if (remainingBalance === 0) break;
	}

	// The loop can also exit by hitting `maxMonths` with money still owed. That
	// is NOT a 30-year payoff: it means the payment never outruns the interest
	// and the balance grows (or stalls) forever. This only affected
	// snowball/avalanche — `minimums` had an early bail-out above, so the two
	// strategies disagreed inside the same dialog, and the extra-payment
	// slider at 0 turned the "extra" strategies into minimums-only while
	// still reporting a 360-month date and a large finite interest total.
	//
	// Report the sentinel instead of a fabricated schedule.
	if (remainingBalance > 0) {
		return {
			months: Infinity,
			totalInterest: Infinity,
			monthlyData,
			neverPayoff: true,
		};
	}

	return {
		months: currentMonth,
		totalInterest: totalInterestPaid,
		monthlyData,
	};
};

/** Progress toward payoff, clamped to 0-100 (overpaid/negative equity → bounds). */
export function getProgress(debt: Debt): number {
	const original = toNumber(debt.original_amount);
	if (original === 0) return 100;
	const paid = original - toNumber(debt.current_balance);
	return Math.max(0, Math.min((paid / original) * 100, 100));
}

/** Months until payoff with minimum payments only, or null if never. */
export function calculatePayoffTime(debt: Debt): number | null {
	const balance = toNumber(debt.current_balance);
	const minimum = toNumber(debt.minimum_payment);
	if (balance === 0 || minimum === 0) return null;

	const monthlyRate = toNumber(debt.interest_rate) / 100 / 12;
	if (monthlyRate === 0) {
		return Math.ceil(balance / minimum);
	}

	if (minimum <= balance * monthlyRate) {
		return null;
	}

	const months =
		Math.log(minimum / (minimum - balance * monthlyRate)) /
		Math.log(1 + monthlyRate);
	return isNaN(months) || !isFinite(months) ? null : Math.ceil(months);
}

/**
 * Total interest paid over the minimum-payment lifetime.
 *
 * NOTE: payoffMonths is rounded UP with ceil (a partial final month is still a
 * payment), so this slightly OVERSTATES interest when the final payment is
 * smaller than the minimum. That's intentional — it errs on the side of
 * caution for the "interest warning" UI.
 */
export function calculateTotalInterest(debt: Debt): number {
	const payoffMonths = calculatePayoffTime(debt);
	if (!payoffMonths || payoffMonths <= 0) return 0;

	const totalPaid = toNumber(debt.minimum_payment) * payoffMonths;
	return Math.max(0, totalPaid - toNumber(debt.current_balance));
}

export interface DebtStrategies {
	snowballStrategy: Debt[];
	avalancheStrategy: Debt[];
	activeDebts: Debt[];
	paidOffDebts: Debt[];
	totalDebt: number;
	totalOriginal: number;
	totalMinPayment: number;
	avgInterestRate: number;
	totalPaid: number;
}

/** Derived debt collections and aggregates (pure, memoize at the call site). */
export function buildStrategies(debts: Debt[]): DebtStrategies {
	const activeDebts = debts.filter(
		(d) => d.is_active && toNumber(d.current_balance) > 0,
	);
	const paidOffDebts = debts.filter(
		(d) => !d.is_active || toNumber(d.current_balance) === 0,
	);
	const totalDebt = activeDebts.reduce(
		(sum, d) => sum + toNumber(d.current_balance),
		0,
	);
	// `totalOriginal` MUST be scoped to the same population as `totalDebt`.
	//
	// It used to sum over ALL debts while `totalDebt` summed only active ones,
	// and any inactive debt was filed under "paid off". Since
	// `validateUpdateDebtInput` allows `is_active` and `current_balance` to be
	// set independently, `PUT /api/debts {"is_active": false}` alone was a legal
	// request — and it silently inflated the header:
	//
	//   A (orig 10000, bal 5000, active), B (orig 5000, bal 5000, active)
	//   before -> totalOriginal 15000, totalDebt 10000, totalPaid  5000  "33% Paid Off"
	//   after  -> totalOriginal 15000, totalDebt  5000, totalPaid 10000  "67% Paid Off"
	//
	// …while B still owed ₹5,000, and "Total Debt Remaining" under-reported by
	// the same amount. An archived debt is not a paid one.
	//
	// Use the same filter for both so the ratio is always meaningful.
	const totalOriginal = activeDebts.reduce(
		(sum, d) => sum + toNumber(d.original_amount),
		0,
	);
	const totalMinPayment = activeDebts.reduce(
		(sum, d) => sum + toNumber(d.minimum_payment),
		0,
	);
	// Balance-weighted average APR: Σ(rate × balance) / Σ(balance). A plain
	// mean would overstate the "typical" rate on a small high-APR card.
	// The plain-mean fallback is unreachable — `activeDebts` is filtered on
	// `current_balance > 0`, so `length > 0` implies `totalDebt > 0` — but it
	// is kept as a guard rather than a branch.
	const avgInterestRate =
		totalDebt > 0
			? activeDebts.reduce(
					(sum, d) =>
						sum + toNumber(d.interest_rate) * toNumber(d.current_balance),
					0,
				) / totalDebt
			: 0;
	const totalPaid = Math.max(0, totalOriginal - totalDebt);

	return {
		snowballStrategy: [...activeDebts].sort(
			(a, b) =>
				toNumber(a.current_balance) - toNumber(b.current_balance),
		),
		avalancheStrategy: [...activeDebts].sort(
			(a, b) => toNumber(b.interest_rate) - toNumber(a.interest_rate),
		),
		activeDebts,
		paidOffDebts,
		totalDebt,
		totalOriginal,
		totalMinPayment,
		avgInterestRate,
		totalPaid,
	};
}

export interface DebtSimulations {
	snowball: SimulationResult;
	avalanche: SimulationResult;
	minimums: SimulationResult;
	mergedData: {
		month: number;
		dateLabel: string;
		snowball: number;
		avalanche: number;
		minimums: number;
	}[];
}

/** Payoff simulations across strategies plus the merged chart series. */
export function buildSimulations(
	debts: Debt[],
	extraPayment: number,
): DebtSimulations {
	const activeDebtsList = debts.filter(
		(d) => d.is_active && toNumber(d.current_balance) > 0,
	);
	if (activeDebtsList.length === 0) {
		return {
			snowball: { months: 0, totalInterest: 0, monthlyData: [] },
			avalanche: { months: 0, totalInterest: 0, monthlyData: [] },
			minimums: { months: 0, totalInterest: 0, monthlyData: [] },
			mergedData: [],
		};
	}

	const snowballRes = runSimulation(activeDebtsList, extraPayment, "snowball");
	const avalancheRes = runSimulation(
		activeDebtsList,
		extraPayment,
		"avalanche",
	);
	const minOnlyRes = runSimulation(activeDebtsList, 0, "minimums");

	const mergedData = [];
	const maxLen = Math.max(
		snowballRes.monthlyData.length,
		avalancheRes.monthlyData.length,
		minOnlyRes.monthlyData.length,
	);

	const now = new Date();
	// A never-payoff simulation stops at month 0 by construction. Filling the
	// remaining horizon with 0 would visually claim the debt vanishes instantly;
	// instead hold the last known balance flat — "still unpaid" is the truth.
	const holdMinimumsFlat = minOnlyRes.neverPayoff === true;
	let lastMinOnlyBalance = minOnlyRes.monthlyData.at(-1)?.remainingBalance ?? 0;

	for (let i = 0; i < maxLen; i++) {
		const dateLabel = format(
			new Date(now.getFullYear(), now.getMonth() + i, 1),
			"MMM yyyy",
		);
		const snowballVal =
			i < snowballRes.monthlyData.length
				? snowballRes.monthlyData[i].remainingBalance
				: 0;
		const avalancheVal =
			i < avalancheRes.monthlyData.length
				? avalancheRes.monthlyData[i].remainingBalance
				: 0;
		let minOnlyVal =
			i < minOnlyRes.monthlyData.length
				? minOnlyRes.monthlyData[i].remainingBalance
				: 0;

		if (holdMinimumsFlat && minOnlyVal === 0 && lastMinOnlyBalance > 0) {
			minOnlyVal = lastMinOnlyBalance;
		}
		if (minOnlyVal > 0) {
			lastMinOnlyBalance = minOnlyVal;
		}

		mergedData.push({
			month: i,
			dateLabel,
			snowball: snowballVal,
			avalanche: avalancheVal,
			minimums: minOnlyVal,
		});
	}

	return {
		snowball: snowballRes,
		avalanche: avalancheRes,
		minimums: minOnlyRes,
		mergedData,
	};
}
