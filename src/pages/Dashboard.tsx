import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	StatCard,
	RecentTransactions,
	SpendingChart,
	BudgetOverview,
	AICoach,
	FinancialHealthScore,
} from "@/components/dashboard";
import { api } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import { parseTransactionDate } from "@/lib/date-utils";
import { toNumber } from "@/lib/number";
import type {
	Transaction,
	DashboardStats,
	SpendingByCategory,
	MonthlyTrend,
	Category,
} from "@/types";
import { Link } from "react-router-dom";
import { useAIInsights, type Insight } from "@/hooks/useAIInsights";
import { useFinancialHealth } from "@/hooks/useFinancialHealth";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/system/ErrorState";

// Extended stats to include last month for comparisons.
// Deltas are `null` whenever there is no honest baseline (last month was 0),
// so the UI can hide badges instead of fabricating "+100%".
interface ExtendedDashboardStats extends DashboardStats {
	lastMonthIncome: number;
	lastMonthExpenses: number;
	incomeChange: number | null;
	expensesChange: number | null;
}

// Helper to get local date string (YYYY-MM-DD) to avoid timezone issues
function getLocalDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

const EMPTY_STATS: ExtendedDashboardStats = {
	totalBalance: 0,
	monthlyIncome: 0,
	monthlyExpenses: 0,
	monthlyNet: 0,
	savingsRate: 0,
	lastMonthIncome: 0,
	lastMonthExpenses: 0,
	incomeChange: null,
	expensesChange: null,
};

/** Mirrors a loaded StatCard while its section fetch is in flight. */
function StatCardSkeleton() {
	return (
		<div
			className="rounded-2xl border border-border bg-card p-5"
			aria-hidden="true"
		>
			<div className="mb-3 flex items-center justify-between">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-5 w-14 rounded-full" />
			</div>
			<Skeleton className="mb-3 h-8 w-28" />
			<Skeleton className="h-3 w-20" />
		</div>
	);
}

export function Dashboard() {
	const { user } = useAuth();
	const { formatCurrency } = usePreferences();
	const [stats, setStats] = useState<ExtendedDashboardStats>(EMPTY_STATS);
	const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
		[],
	);
	const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
	const [spendingByCategory, setSpendingByCategory] = useState<
		SpendingByCategory[]
	>([]);
	const [previousMonthSpending, setPreviousMonthSpending] = useState<
		SpendingByCategory[]
	>([]);

	// Granular loading flags so each section can show its own skeleton
	// instead of holding the whole page hostage behind one spinner.
	const [loadingStats, setLoadingStats] = useState(true);
	const [loadingBalance, setLoadingBalance] = useState(true);
	const [loadingCategories, setLoadingCategories] = useState(true);
	const [loadingTrends, setLoadingTrends] = useState(true);
	const [loadingRecent, setLoadingRecent] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const {
		data: healthData,
		loading: healthLoading,
		error: healthError,
		refresh: refreshHealth,
	} = useFinancialHealth();

	const loadDashboard = useCallback(async () => {
		// No synchronous state resets here: on mount the loading flags already
		// start `true` and error starts `null`, so the effect below triggers no
		// cascading sync renders. Retries go through `retryDashboard`, which
		// performs the resets from an event handler before calling this.
		if (!user) {
			return;
		}

		try {
			const now = new Date();
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			const startOfLastMonth = new Date(
				now.getFullYear(),
				now.getMonth() - 1,
				1,
			);
			const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

			// Use local date strings to avoid timezone issues
			const startOfMonthStr = getLocalDateString(startOfMonth);
			const startOfLastMonthStr = getLocalDateString(startOfLastMonth);
			const sixMonthsAgoStr = getLocalDateString(sixMonthsAgo);

			const transactionsRes = await api.transactions.list({
				since: sixMonthsAgoStr,
			});
			const allTransactions = (transactionsRes.transactions ||
				[]) as Transaction[];
			setRecentTransactions(allTransactions.slice(0, 10));
			setLoadingRecent(false);

			// Fetch accounts in parallel for total balance
			const accountsPromise = api.accounts.list();

			type TwoMonthRow = {
				type: Transaction["type"];
				amount: Transaction["amount"];
				date: string | Date;
				category: Category | null;
			};

			const twoMonthData = allTransactions.filter((t) => {
				const dateVal = String(t.date).split("T")[0];
				return dateVal >= startOfLastMonthStr;
			}) as TwoMonthRow[];

			{
				// Helper to normalize date to YYYY-MM-DD (PostgreSQL may return Date objects or ISO strings)
				const normalizeDate = (dateVal: string | Date): string => {
					if (dateVal instanceof Date) {
						const year = dateVal.getFullYear();
						const month = String(dateVal.getMonth() + 1).padStart(2, "0");
						const day = String(dateVal.getDate()).padStart(2, "0");
						return `${year}-${month}-${day}`;
					}
					// If it's a string, strip time portion if present
					return String(dateVal).split("T")[0];
				};

				// Split into current and last month
				const currentMonthData = twoMonthData.filter(
					(t) => normalizeDate(t.date) >= startOfMonthStr,
				);
				const lastMonthData = twoMonthData.filter(
					(t) =>
						normalizeDate(t.date) >= startOfLastMonthStr &&
						normalizeDate(t.date) < startOfMonthStr,
				);

				// Calculate current month stats
				const income = currentMonthData
					.filter((t) => t.type === "income")
					.reduce((sum, t) => sum + toNumber(t.amount), 0);
				const expenses = currentMonthData
					.filter((t) => t.type === "expense")
					.reduce((sum, t) => sum + toNumber(t.amount), 0);

				const lastMonthIncome = lastMonthData
					.filter((t) => t.type === "income")
					.reduce((sum, t) => sum + toNumber(t.amount), 0);
				const lastMonthExpenses = lastMonthData
					.filter((t) => t.type === "expense")
					.reduce((sum, t) => sum + toNumber(t.amount), 0);

				// Percentage changes — only when an honest baseline exists.
				// No last-month data ⇒ null ⇒ the UI hides the badge rather than
				// inventing "+100%" out of thin air.
				const incomeChange =
					lastMonthIncome > 0
						? ((income - lastMonthIncome) / lastMonthIncome) * 100
						: null;
				const expensesChange =
					lastMonthExpenses > 0
						? ((expenses - lastMonthExpenses) / lastMonthExpenses) * 100
						: null;

				setStats({
					totalBalance: 0, // Will be updated by accounts fetch
					monthlyIncome: income,
					monthlyExpenses: expenses,
					monthlyNet: income - expenses,
					savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
					lastMonthIncome,
					lastMonthExpenses,
					incomeChange,
					expensesChange,
				});
				setLoadingStats(false);

				// Calculate Spending by Category. Shares are computed against the
				// CATEGORIZED subtotal so slices genuinely sum to ~100% (uncategorized
				// spend is excluded from the pie rather than diluting every share).
				const categoryMap = new Map<
					string,
					{ amount: number; color: string }
				>();
				let categorizedTotal = 0;

				currentMonthData
					.filter((t) => t.type === "expense" && t.category)
					.forEach((t) => {
						const amount = toNumber(t.amount);
						categorizedTotal += amount;
						const category = t.category;
						const catName = category?.name || "Uncategorized";
						const catColor = category?.color || "#94a3b8";
						const current = categoryMap.get(catName) || {
							amount: 0,
							color: catColor,
						};
						categoryMap.set(catName, {
							amount: current.amount + amount,
							color: catColor,
						});
					});

				const spendingData: SpendingByCategory[] = Array.from(
					categoryMap.entries(),
				)
					.map(([category, { amount, color }]) => ({
						category,
						amount,
						color,
						percentage:
							categorizedTotal > 0 ? (amount / categorizedTotal) * 100 : 0,
					}))
					.sort((a, b) => b.amount - a.amount);

				setSpendingByCategory(spendingData);
				setLoadingCategories(false);

				// Calculate Spending by Category for last month
				const lastCategoryMap = new Map<
					string,
					{ amount: number; color: string }
				>();
				let lastCategorizedTotal = 0;

				lastMonthData
					.filter((t) => t.type === "expense" && t.category)
					.forEach((t) => {
						const amount = toNumber(t.amount);
						lastCategorizedTotal += amount;
						const category = t.category;
						const catName = category?.name || "Uncategorized";
						const catColor = category?.color || "#94a3b8";
						const current = lastCategoryMap.get(catName) || {
							amount: 0,
							color: catColor,
						};
						lastCategoryMap.set(catName, {
							amount: current.amount + amount,
							color: catColor,
						});
					});

				const lastSpendingData: SpendingByCategory[] = Array.from(
					lastCategoryMap.entries(),
				)
					.map(([category, { amount, color }]) => ({
						category,
						amount,
						color,
						percentage:
							lastCategorizedTotal > 0 ? (amount / lastCategorizedTotal) * 100 : 0,
					}))
					.sort((a, b) => b.amount - a.amount);

				setPreviousMonthSpending(lastSpendingData);
			}

			// Fetch 6-month trend data
			const trendData = allTransactions
				.filter((t) => String(t.date).split("T")[0] >= sixMonthsAgoStr)
				.map((t) => ({
					type: t.type,
					amount: t.amount as number,
					date: String(t.date),
				}));

			{
				// Bucket by the transaction's LOCAL date parts (year-month key).
				// Formatting UTC-parsed dates with toLocaleString shifted months
				// for timezones behind UTC.
				const monthKey = (date: string): string => {
					const d = parseTransactionDate(date);
					return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
				};

				const monthsMap = new Map<
					string,
					{ income: number; expenses: number }
				>();

				// Initialize last 6 months with their year-month keys
				const orderedMonths: Array<{ key: string; label: string }> = [];
				for (let i = 5; i >= 0; i--) {
					const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
					const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
					orderedMonths.push({
						key,
						label: d.toLocaleString("default", { month: "short" }),
					});
					monthsMap.set(key, { income: 0, expenses: 0 });
				}

				trendData.forEach((t) => {
					const key = monthKey(t.date);
					if (monthsMap.has(key)) {
						const current = monthsMap.get(key)!;
						if (t.type === "income") current.income += toNumber(t.amount);
						if (t.type === "expense") current.expenses += toNumber(t.amount);
					}
				});

				const monthlyTrendData: MonthlyTrend[] = orderedMonths.map(
					({ key, label }) => ({
						month: label,
						income: monthsMap.get(key)?.income || 0,
						expenses: monthsMap.get(key)?.expenses || 0,
					}),
				);

				setMonthlyTrends(monthlyTrendData);
				setLoadingTrends(false);
			}

			// Fetch accounts for total balance (already started in parallel)
			const accountsRes = await accountsPromise;
			const rawAccounts = accountsRes.accounts || [];
			const totalBalance = rawAccounts
				.filter((a) => a.is_active)
				.reduce((sum: number, a) => sum + toNumber(a.balance), 0);
			setStats((prev) => ({ ...prev, totalBalance }));
			setLoadingBalance(false);
		} catch (error) {
			console.error("Error fetching dashboard data:", error);
			// Never render silent zeros over a failed fetch — surface it.
			setError(
				error instanceof Error
					? error.message
					: "We couldn't load your dashboard data.",
			);
			setLoadingStats(false);
			setLoadingBalance(false);
			setLoadingCategories(false);
			setLoadingTrends(false);
			setLoadingRecent(false);
		}
	}, [user]);

	useEffect(() => {
		// Explicit async boundary: every setState inside loadDashboard happens
		// after its first await, and the explicit await keeps the compiler lint
		// (react-hooks/set-state-in-effect) able to verify that.
		(async () => {
			await loadDashboard();
		})();
	}, [loadDashboard]);

	// Retry path: resets run synchronously inside an event handler (allowed),
	// then the fetch itself never touches state before its first await.
	const retryDashboard = useCallback(() => {
		setError(null);
		setLoadingStats(true);
		setLoadingBalance(true);
		setLoadingCategories(true);
		setLoadingTrends(true);
		setLoadingRecent(true);
		loadDashboard();
	}, [loadDashboard]);

	const {
		insights,
		loading: insightsLoading,
		error: insightsError,
		dismissInsight,
		retry: retryInsights,
	} = useAIInsights();
	const anomalies: Insight[] = insights.filter((i) => i.type === "anomaly");

	// Derived, honest copy for the stat cards
	const incomeDelta = stats.incomeChange;
	const expensesDelta = stats.expensesChange;

	return (
		<div className="space-y-6">
			{/* Header with Quick Actions */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between motion-safe:animate-fade-in-up">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text">
						Dashboard
					</h1>
					<p className="text-sm sm:text-base text-muted-foreground">
						Welcome back! Here's your financial overview.
					</p>
				</div>
				<div className="flex gap-2">
					<Button asChild className="w-full sm:w-auto font-semibold active:scale-[0.98]">
						<Link to="/transactions?action=new">
							<Plus className="mr-2 h-4 w-4" />
							Add Transaction
						</Link>
					</Button>
				</div>
			</div>

			{/* Stats Cards sit directly under the header */}
			<div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
				<div className="motion-safe:animate-fade-in-up motion-safe:animate-delay-50">
					{loadingBalance ? (
						<StatCardSkeleton />
					) : (
						<StatCard
							title="Total Balance"
							value={formatCurrency(stats.totalBalance)}
							trendDescription={
								stats.totalBalance >= 0 ? "Net worth positive" : "Building up"
							}
							subtitle="Across all accounts"
							changeType={stats.totalBalance >= 0 ? "positive" : "neutral"}
						/>
					)}
				</div>
				<div className="motion-safe:animate-fade-in-up motion-safe:animate-delay-100">
					{loadingStats ? (
						<StatCardSkeleton />
					) : (
						<StatCard
							title="Monthly Income"
							value={formatCurrency(stats.monthlyIncome)}
							percentageChange={
								incomeDelta !== null
									? `${incomeDelta >= 0 ? "+" : ""}${incomeDelta.toFixed(1)}%`
									: undefined
							}
							trendDescription={
								incomeDelta === null
									? stats.monthlyIncome > 0
										? "New this month"
										: "No income yet"
									: incomeDelta >= 0
										? "Up from last month"
										: "Down from last month"
							}
							subtitle="Income this period"
							changeType={
								incomeDelta === null
									? "neutral"
									: incomeDelta >= 0
										? "positive"
										: "negative"
							}
						/>
					)}
				</div>
				<div className="motion-safe:animate-fade-in-up motion-safe:animate-delay-150">
					{loadingStats ? (
						<StatCardSkeleton />
					) : (
						<StatCard
							title="Monthly Expenses"
							value={formatCurrency(stats.monthlyExpenses)}
							percentageChange={
								expensesDelta !== null
									? `${expensesDelta >= 0 ? "+" : ""}${expensesDelta.toFixed(1)}%`
									: undefined
							}
							trendDescription={
								expensesDelta === null
									? stats.monthlyExpenses > 0
										? "New this month"
										: "No spending yet"
									: expensesDelta <= 0
										? "Down from last month"
										: "Up from last month"
							}
							subtitle={
								expensesDelta === null
									? "This period"
									: expensesDelta <= 0
										? "Spending under control"
										: "Review spending"
							}
							changeType={
								expensesDelta === null
									? "neutral"
									: expensesDelta <= 0
										? "positive"
										: "negative"
							}
						/>
					)}
				</div>
				{/* Monthly Net: the savings rate is NOT a MoM delta — no fake
				    percentage badge, no trend arrow chrome. */}
				<div className="motion-safe:animate-fade-in-up motion-safe:animate-delay-200">
					{loadingStats ? (
						<StatCardSkeleton />
					) : (
						<StatCard
							title="Monthly Net"
							value={formatCurrency(stats.monthlyNet)}
							subtitle="of income saved"
							changeType={stats.monthlyNet >= 0 ? "positive" : "negative"}
							valueSemantic={stats.monthlyNet < 0 ? "negative" : undefined}
						/>
					)}
				</div>
			</div>

			{error ? (
				/* Fetch failed — say so, never show a silent $0.00 page */
				<ErrorState
					title="Couldn't load your dashboard"
					message={error}
					onRetry={retryDashboard}
				/>
			) : (
				<>
					{/* Health Score & Spending Flow Row */}
					<div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-2 motion-safe:animate-fade-in-up motion-safe:animate-delay-250">
						<FinancialHealthScore
							data={healthData}
							loading={healthLoading}
							error={healthError}
							onRetry={refreshHealth}
						/>
						<BudgetOverview
							spendingByCategory={spendingByCategory}
							previousMonthData={previousMonthSpending}
							isLoading={loadingCategories}
						/>
					</div>

					{/* Monthly Trends Chart */}
					<div className="w-full motion-safe:animate-fade-in-up relative z-10">
						<SpendingChart data={monthlyTrends} isLoading={loadingTrends} />
					</div>

					{/* Recent Transactions */}
					<div className="motion-safe:animate-fade-in-up">
						<RecentTransactions
							transactions={recentTransactions}
							anomalies={anomalies}
							isLoading={loadingRecent}
						/>
					</div>

					{/* AI Coaching Section */}
					<div className="motion-safe:animate-fade-in-up">
						<AICoach
							insights={insights}
							isLoading={insightsLoading}
							dismissInsight={dismissInsight}
							error={insightsError}
							onRetry={retryInsights}
						/>
					</div>
				</>
			)}
		</div>
	);
}
