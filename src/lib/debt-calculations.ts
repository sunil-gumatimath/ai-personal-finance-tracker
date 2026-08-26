import { format } from "date-fns";
import type { Debt } from "@/types";
import { toNumber } from "@/lib/number";

// Re-exported so existing consumers of debt-calculations keep working.
export { toNumber };

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
	const monthlyData = [
		{
			month: 0,
			remainingBalance: simulatedDebts.reduce(
				(sum, d) => sum + d.current_balance,
				0,
			),
		},
	];

	const maxMonths = 360; // 30 years limit

	// Minimums-only mode: if any debt's payment never covers its monthly
	// interest, that balance grows forever — bail out with a sentinel instead
	// of silently running to the 360-month cap.
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

		const remainingBalance = simulatedDebts.reduce(
			(sum, d) => sum + d.current_balance,
			0,
		);
		monthlyData.push({
			month: currentMonth,
			remainingBalance: Math.round(remainingBalance),
		});

		if (remainingBalance === 0) break;
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
	const totalOriginal = debts.reduce(
		(sum, d) => sum + toNumber(d.original_amount),
		0,
	);
	const totalMinPayment = activeDebts.reduce(
		(sum, d) => sum + toNumber(d.minimum_payment),
		0,
	);
	// Balance-weighted average APR: Σ(rate × balance) / Σ(balance). A plain
	// mean would overstate the "typical" rate on a small high-APR card.
	// Falls back to the plain mean when Σ balance is 0 (e.g. all zeros).
	const avgInterestRate =
		totalDebt > 0
			? activeDebts.reduce(
					(sum, d) =>
						sum + toNumber(d.interest_rate) * toNumber(d.current_balance),
					0,
				) / totalDebt
			: activeDebts.length > 0
				? activeDebts.reduce((sum, d) => sum + toNumber(d.interest_rate), 0) /
					activeDebts.length
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
