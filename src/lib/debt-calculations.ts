import { format } from "date-fns";
import type { Debt } from "@/types";

/** Helper to safely convert to number */
export function toNumber(value: unknown): number {
	if (typeof value === "number") return value;
	if (typeof value === "string") return parseFloat(value) || 0;
	return 0;
}

interface SimulationResult {
	months: number;
	totalInterest: number;
	monthlyData: { month: number; remainingBalance: number }[];
}

const runSimulation = (
	activeDebtsList: Debt[],
	extraPayment: number,
	strategy: "snowball" | "avalanche" | "minimums",
): SimulationResult => {
	const simulatedDebts = activeDebtsList.map((d) => ({
		id: d.id,
		current_balance: d.current_balance,
		interest_rate: d.interest_rate,
		minimum_payment: d.minimum_payment,
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

/** Progress toward payoff (0-100). */
export function getProgress(debt: Debt): number {
	if (debt.original_amount === 0) return 100;
	const paid = debt.original_amount - debt.current_balance;
	return Math.min((paid / debt.original_amount) * 100, 100);
}

/** Months until payoff with minimum payments only, or null if never. */
export function calculatePayoffTime(debt: Debt): number | null {
	if (debt.current_balance === 0 || debt.minimum_payment === 0) return null;

	const monthlyRate = debt.interest_rate / 100 / 12;
	if (monthlyRate === 0) {
		return Math.ceil(debt.current_balance / debt.minimum_payment);
	}

	if (debt.minimum_payment <= debt.current_balance * monthlyRate) {
		return null;
	}

	const months =
		Math.log(
			debt.minimum_payment /
				(debt.minimum_payment - debt.current_balance * monthlyRate),
		) / Math.log(1 + monthlyRate);
	return isNaN(months) || !isFinite(months) ? null : Math.ceil(months);
}

/** Total interest paid over the minimum-payment lifetime. */
export function calculateTotalInterest(debt: Debt): number {
	const payoffMonths = calculatePayoffTime(debt);
	if (!payoffMonths || payoffMonths <= 0) return 0;

	const totalPaid = debt.minimum_payment * payoffMonths;
	return Math.max(0, totalPaid - debt.current_balance);
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
	const activeDebts = debts.filter((d) => d.is_active && d.current_balance > 0);
	const paidOffDebts = debts.filter(
		(d) => !d.is_active || d.current_balance === 0,
	);
	const totalDebt = activeDebts.reduce((sum, d) => sum + d.current_balance, 0);
	const totalOriginal = debts.reduce((sum, d) => sum + d.original_amount, 0);
	const totalMinPayment = activeDebts.reduce(
		(sum, d) => sum + d.minimum_payment,
		0,
	);
	const avgInterestRate =
		activeDebts.length > 0
			? activeDebts.reduce((sum, d) => sum + d.interest_rate, 0) /
				activeDebts.length
			: 0;
	const totalPaid = Math.max(0, totalOriginal - totalDebt);

	return {
		snowballStrategy: [...activeDebts].sort(
			(a, b) => a.current_balance - b.current_balance,
		),
		avalancheStrategy: [...activeDebts].sort(
			(a, b) => b.interest_rate - a.interest_rate,
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
		(d) => d.is_active && d.current_balance > 0,
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
		const minOnlyVal =
			i < minOnlyRes.monthlyData.length
				? minOnlyRes.monthlyData[i].remainingBalance
				: 0;

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
