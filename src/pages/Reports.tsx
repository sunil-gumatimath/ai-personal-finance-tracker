import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import {
	ArrowLeft,
	ArrowRight,
	Download,
	FileText,
	Info,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	XAxis,
	YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/system/ErrorState";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import { api } from "@/lib/api-client";
import { downloadTransactionsCsv } from "@/lib/transaction-csv";
import { parseTransactionDate } from "@/lib/date-utils";
import { formatCompactCurrency, toNumber } from "@/lib/number";
import { currencyLocales } from "@/types/preferences";
import type { Account, Transaction } from "@/types";
import { cn } from "@/lib/utils";

interface CategorySpend {
	category: string;
	amount: number;
	color: string;
	percentage: number;
}

interface MonthlyPoint {
	month: string;
	income: number;
	expenses: number;
}

const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

const CATEGORY_COLORS = [
	"var(--expense)",
	"#f59e0b",
	"#8b5cf6",
	"#06b6d4",
	"#ec4899",
	"#84cc16",
	"#f97316",
	"#6366f1",
];

/** Max transactions fetched for reports — beyond this, results are capped server-side. */
const REPORTS_TX_LIMIT = 1000;

export function Reports() {
	const { user } = useAuth();
	const { formatCurrency, preferences } = usePreferences();
	// Same locale derivation PreferencesContext uses for formatCurrency.
	const locale = currencyLocales[preferences.currency] || "en-US";
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [truncated, setTruncated] = useState(false);
	const [viewMode, setViewMode] = useState<"month" | "year">("month");
	const [periodDate, setPeriodDate] = useState(() => new Date());
	const [exporting, setExporting] = useState(false);

	const fetchData = useCallback(async () => {
		if (!user) {
			setLoading(false);
			return;
		}
		setError(false);
		try {
			const [transactionsRes, accountsRes] = await Promise.all([
				api.transactions.list({ limit: REPORTS_TX_LIMIT }),
				api.accounts.list(),
			]);
			const fetched = Array.isArray(transactionsRes.transactions)
				? transactionsRes.transactions
				: [];
			setTransactions(fetched as Transaction[]);
			// The API caps results; flag when we may be looking at a subset.
			setTruncated(fetched.length >= REPORTS_TX_LIMIT);
			setAccounts(
				(Array.isArray(accountsRes.accounts)
					? accountsRes.accounts
					: []) as Account[],
			);
		} catch (err) {
			console.error("Error fetching report data:", err);
			// Failed fetches must not render zeroed summary cards.
			setError(true);
		} finally {
			setLoading(false);
		}
	}, [user]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// Shared trailing-12-month window. Keys are LOCAL year-month pairs so both
	// the period filter and the monthly chart agree on what "last 12 months"
	// means regardless of timezone.
	const last12Months = useMemo(() => {
		const now = new Date();
		const months: Array<{ key: string; label: string }> = [];
		for (let i = 11; i >= 0; i--) {
			const monthDate = subMonths(now, i);
			months.push({
				key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
				label: `${MONTH_LABELS[monthDate.getMonth()]} ${String(monthDate.getFullYear()).slice(2)}`,
			});
		}
		return months;
	}, []);

	const inPeriod = useCallback(
		(t: Transaction): boolean => {
			const d = parseTransactionDate(t.date);
			if (viewMode === "month") {
				return (
					d.getFullYear() === periodDate.getFullYear() &&
					d.getMonth() === periodDate.getMonth()
				);
			}
			const key = `${d.getFullYear()}-${d.getMonth()}`;
			return last12Months.some((m) => m.key === key);
		},
		[viewMode, periodDate, last12Months],
	);

	const periodTransactions = useMemo(
		() => transactions.filter(inPeriod),
		[transactions, inPeriod],
	);

	const totals = useMemo(() => {
		let income = 0;
		let expenses = 0;
		for (const t of periodTransactions) {
			if (t.type === "income") income += toNumber(t.amount);
			else if (t.type === "expense") expenses += toNumber(t.amount);
		}
		return { income, expenses, net: income - expenses };
	}, [periodTransactions]);

	const savingsRate =
		totals.income > 0
			? Math.round((totals.net / totals.income) * 1000) / 10
			: 0;

	const categorySpending = useMemo<CategorySpend[]>(() => {
		const byCategory = new Map<string, { amount: number; color: string }>();
		for (const t of periodTransactions) {
			if (t.type !== "expense") continue;
			const name = t.category?.name || "Uncategorized";
			const existing = byCategory.get(name) || {
				amount: 0,
				color: t.category?.color || "#94a3b8",
			};
			existing.amount += toNumber(t.amount);
			byCategory.set(name, existing);
		}
		const total = [...byCategory.values()].reduce((s, c) => s + c.amount, 0);
		return [...byCategory.entries()]
			.map(([category, { amount, color }]) => ({
				category,
				amount,
				color,
				percentage: total > 0 ? (amount / total) * 100 : 0,
			}))
			.sort((a, b) => b.amount - a.amount);
	}, [periodTransactions]);

	const monthlyTrend = useMemo<MonthlyPoint[]>(() => {
		const points: MonthlyPoint[] = [];
		for (const { key, label } of last12Months) {
			let income = 0;
			let expenses = 0;
			for (const t of transactions) {
				const d = parseTransactionDate(t.date);
				if (`${d.getFullYear()}-${d.getMonth()}` !== key) continue;
				if (t.type === "income") income += toNumber(t.amount);
				else if (t.type === "expense") expenses += toNumber(t.amount);
			}
			points.push({
				month: label,
				income: Math.round(income * 100) / 100,
				expenses: Math.round(expenses * 100) / 100,
			});
		}
		return points;
	}, [transactions, last12Months]);

	const periodTransactionsSorted = useMemo(
		() => [...periodTransactions].sort((a, b) => b.date.localeCompare(a.date)),
		[periodTransactions],
	);

	const periodLabel =
		viewMode === "month"
			? format(periodDate, "MMMM yyyy")
			: `Last 12 months (${format(new Date(), "MMM yyyy")})`;

	const shiftPeriod = (delta: number) => {
		setPeriodDate(
			(prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
		);
	};

	// Can't navigate into the future — next arrow disables at the current month.
	const nowDate = new Date();
	const currentMonthStart = new Date(
		nowDate.getFullYear(),
		nowDate.getMonth(),
		1,
	);
	const canGoNext = periodDate.getTime() < currentMonthStart.getTime();

	// All-zero history renders a textual empty state, not flat-zero axes.
	const trendHasData = monthlyTrend.some(
		(p) => p.income > 0 || p.expenses > 0,
	);

	// Top-6 truncation bookkeeping (chart + list + PDF stay consistent).
	const CATEGORY_TOP_N = 6;
	const categoryOverflow = Math.max(0, categorySpending.length - CATEGORY_TOP_N);

	// ------------------------------------------------------------------ PDF
	const exportPdf = async () => {
		setExporting(true);
		try {
			const doc = new jsPDF() as jsPDF & {
				lastAutoTable?: { finalY?: number };
			};
			doc.setFontSize(16);
			doc.text("Personal Finance Report", 14, 18);
			doc.setFontSize(10);
			doc.setTextColor(100);
			doc.text(
				`${periodLabel} — generated ${format(new Date(), "MMM d, yyyy HH:mm")}`,
				14,
				25,
			);
			doc.setTextColor(0);

			autoTable(doc, {
				startY: 32,
				head: [["Summary", ""]],
				body: [
					["Income", formatCurrency(totals.income)],
					["Expenses", formatCurrency(totals.expenses)],
					["Net savings", formatCurrency(totals.net)],
					["Savings rate", `${savingsRate}%`],
				],
				theme: "striped",
				headStyles: { fillColor: [59, 130, 246] },
			});

			const categoryRows = categorySpending
				.slice(0, CATEGORY_TOP_N)
				.map((c) => [c.category, formatCurrency(c.amount), `${c.percentage.toFixed(1)}%`]);
			if (categoryOverflow > 0) {
				categoryRows.push([`…and ${categoryOverflow} more — see CSV export`, "", ""]);
			}
			autoTable(doc, {
				startY: (doc.lastAutoTable?.finalY ?? 70) + 8,
				head: [["Category", "Spent", "Share"]],
				body:
					categoryRows.length > 0
						? categoryRows
						: [["No expenses in this period", "-", "-"]],
				theme: "striped",
				headStyles: { fillColor: [16, 185, 129] },
			});

			const txRows = periodTransactionsSorted
				.slice(0, 50)
				.map((t) => [
					t.date,
					t.type,
					t.category?.name || "-",
					t.description || "",
					formatCurrency(toNumber(t.amount)),
				]);
			autoTable(doc, {
				startY: (doc.lastAutoTable?.finalY ?? 70) + 8,
				head: [["Date", "Type", "Category", "Description", "Amount"]],
				body:
					txRows.length > 0
						? txRows
						: [["No transactions in this period", "", "", "", ""]],
				theme: "striped",
				headStyles: { fillColor: [139, 92, 246] },
			});

			doc.save(`finance-report-${format(periodDate, "yyyy-MM")}.pdf`);
			toast.success("PDF report downloaded");
		} catch (error) {
			console.error("PDF export error:", error);
			toast.error("Failed to export PDF");
		} finally {
			setExporting(false);
		}
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-10 w-64" />
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{[...Array(4)].map((_, i) => (
						<Skeleton key={i} className="h-28 rounded-xl" />
					))}
				</div>
				{/* Chart-shaped placeholders keep layout stable while loading */}
				<Skeleton className="h-[280px] w-full rounded-xl" />
				<div className="grid gap-4 lg:grid-cols-2">
					<Skeleton className="h-[220px] w-full rounded-xl" />
					<div className="space-y-4">
						<Skeleton className="h-40 w-full rounded-xl" />
						<Skeleton className="h-56 w-full rounded-xl" />
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
					Reports
				</h1>
				<ErrorState
					title="Couldn't load your report"
					message="We couldn't reach your transactions and accounts. Check your connection and try again."
					onRetry={fetchData}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
						Reports
					</h1>
					<p className="text-sm sm:text-base text-muted-foreground">
						Monthly and yearly financial summaries, exportable to PDF and CSV
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => downloadTransactionsCsv(periodTransactionsSorted)}
						className="flex-1 sm:flex-none"
					>
						<Download className="mr-2 h-4 w-4" />
						<span className="hidden sm:inline">Export CSV</span>
						<span className="sm:hidden">CSV</span>
					</Button>
					<Button
						onClick={exportPdf}
						disabled={exporting}
						className="flex-1 sm:flex-none"
					>
						<FileText className="mr-2 h-4 w-4" />
						{exporting ? "Exporting…" : "Export PDF"}
					</Button>
				</div>
			</div>

			{/* Truncation notice — the API caps the fetch size */}
			{truncated && (
				<div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
					<Info className="h-3.5 w-3.5 shrink-0" />
					Showing most recent {REPORTS_TX_LIMIT} transactions.
				</div>
			)}

			{/* Period selector */}
			<div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:bg-card/80">
				<div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
				<div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2">
						<Button
							variant={viewMode === "month" ? "default" : "ghost"}
							size="sm"
							aria-pressed={viewMode === "month"}
							onClick={() => setViewMode("month")}
						>
							Month
						</Button>
						<Button
							variant={viewMode === "year" ? "default" : "ghost"}
							size="sm"
							aria-pressed={viewMode === "year"}
							onClick={() => setViewMode("year")}
						>
							Last 12 months
						</Button>
					</div>
					{viewMode === "month" && (
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								aria-label="Previous month"
								onClick={() => shiftPeriod(-1)}
							>
								<ArrowLeft className="h-4 w-4" aria-hidden="true" />
							</Button>
							<span className="w-36 text-center text-sm font-semibold">
								{periodLabel}
							</span>
							<Button
								variant="outline"
								size="icon"
								aria-label="Next month"
								disabled={!canGoNext}
								onClick={() => shiftPeriod(1)}
							>
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Button>
						</div>
					)}
					{viewMode === "year" && (
						<span className="text-sm font-semibold">{periodLabel}</span>
					)}
				</div>
			</div>

			{/* Summary cards */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card className="border-border/50 bg-card/50">
					<CardContent className="p-5">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<TrendingUp className="h-4 w-4 text-[var(--income)]" />
							Income
						</div>
						<p className="mt-2 text-2xl font-bold tracking-tight text-[var(--income)] tabular-nums">
							{formatCurrency(totals.income)}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border/50 bg-card/50">
					<CardContent className="p-5">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<TrendingDown className="h-4 w-4 text-[var(--expense)]" />
							Expenses
						</div>
						<p className="mt-2 text-2xl font-bold tracking-tight text-[var(--expense)] tabular-nums">
							{formatCurrency(totals.expenses)}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border/50 bg-card/50">
					<CardContent className="p-5">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Wallet className="h-4 w-4" />
							Net Savings
						</div>
						{/* Explicit sign so a near-zero net never reads ambiguous */}
						<p
							className={cn(
								"mt-2 text-2xl font-bold tracking-tight tabular-nums",
								totals.net >= 0
									? "text-[var(--income)]"
									: "text-[var(--expense)]",
							)}
						>
							{totals.net >= 0 ? "+" : "−"}
							{formatCurrency(Math.abs(totals.net))}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border/50 bg-card/50">
					<CardContent className="p-5">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Wallet className="h-4 w-4" />
							Savings Rate
						</div>
						<p
							className={cn(
								"mt-2 text-2xl font-bold tracking-tight tabular-nums",
								savingsRate >= 20
									? "text-[var(--income)]"
									: savingsRate >= 0
										? "text-amber-500"
										: "text-[var(--expense)]",
							)}
						>
							{savingsRate}%
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Monthly trend */}
			<Card className="border-border/50 bg-card/50">
				<CardHeader>
					<CardTitle>Income vs. Expenses — last 12 months</CardTitle>
					<CardDescription>
						Net cash flow across your recent history
					</CardDescription>
				</CardHeader>
				<CardContent>
					{trendHasData ? (
						<ChartContainer
							config={{
								income: { label: "Income", color: "var(--income)" },
								expenses: { label: "Expenses", color: "var(--expense)" },
							}}
							className="h-[280px] w-full"
						>
							<AreaChart data={monthlyTrend}>
								<CartesianGrid vertical={false} strokeDasharray="3 3" />
								<XAxis
									dataKey="month"
									tickLine={false}
									axisLine={false}
									fontSize={11}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									fontSize={11}
									width={70}
									tickFormatter={(val) =>
										formatCompactCurrency(Number(val), preferences.currency, locale)
									}
								/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										indicator="dot"
										formatter={(value, name) => (
											<div className="flex items-center justify-between gap-6 text-xs">
												<span className="text-muted-foreground">{name}</span>
												<span
													className={cn(
														"font-bold tabular-nums",
														name === "Income"
															? "text-[var(--income)]"
															: "text-[var(--expense)]",
													)}
												>
													{formatCurrency(Number(value))}
												</span>
											</div>
										)}
									/>
								}
							/>
							<Area
								type="monotone"
								name="Income"
								dataKey="income"
								stroke="var(--income)"
								fill="var(--income)"
								fillOpacity={0.15}
								strokeWidth={2}
							/>
							<Area
								type="monotone"
								name="Expenses"
								dataKey="expenses"
								stroke="var(--expense)"
								fill="var(--expense)"
								fillOpacity={0.15}
								strokeWidth={2}
							/>
							</AreaChart>
						</ChartContainer>
					) : (
						<p className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
							No income or expense activity in the last 12 months.
						</p>
					)}
				</CardContent>
			</Card>

			<div className="grid gap-4 lg:grid-cols-2">
				{/* Category breakdown */}
				<Card className="border-border/50 bg-card/50">
					<CardHeader>
						<CardTitle>Spending by Category</CardTitle>
						<CardDescription>{periodLabel}</CardDescription>
					</CardHeader>
					<CardContent>
						{categorySpending.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No expenses recorded in this period.
							</p>
						) : (
							<>
								<ChartContainer config={{}} className="h-[220px] w-full">
									<BarChart
										data={categorySpending.slice(0, CATEGORY_TOP_N)}
										layout="vertical"
										margin={{ left: 8 }}
									>
										<CartesianGrid horizontal={false} strokeDasharray="3 3" />
										<XAxis
											type="number"
											tickLine={false}
											axisLine={false}
											fontSize={11}
											hide
										/>
										<YAxis
											type="category"
											dataKey="category"
											tickLine={false}
											axisLine={false}
											fontSize={11}
											width={90}
										/>
										<ChartTooltip
											formatter={(value: number) => [
												formatCurrency(value),
												"Spent",
											]}
										/>
										<Bar dataKey="amount" radius={[0, 6, 6, 0]}>
											{categorySpending
												.slice(0, CATEGORY_TOP_N)
												.map((entry, index) => (
													<Cell
														key={entry.category}
														// Same color as the mini bars below; the fixed
														// palette is only a fallback for uncategorized rows.
														fill={
															entry.color ||
															CATEGORY_COLORS[index % CATEGORY_COLORS.length]
														}
													/>
												))}
										</Bar>
									</BarChart>
								</ChartContainer>
								<div className="mt-4 space-y-2.5">
									{categorySpending.slice(0, CATEGORY_TOP_N).map((entry) => (
										<div key={entry.category} className="space-y-1">
											<div className="flex items-center justify-between text-xs">
												<span className="font-medium">{entry.category}</span>
												<span className="text-muted-foreground tabular-nums">
													{formatCurrency(entry.amount)} ·{" "}
													{entry.percentage.toFixed(1)}%
												</span>
											</div>
											<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
												<div
													className="h-full rounded-full transition-all"
													style={{
														width: `${Math.min(entry.percentage, 100)}%`,
														backgroundColor:
															entry.color ||
															CATEGORY_COLORS[0],
													}}
												/>
											</div>
										</div>
									))}
								</div>
								{categoryOverflow > 0 && (
									<p className="mt-3 text-xs text-muted-foreground">
										* Showing top {CATEGORY_TOP_N} of {categorySpending.length}{" "}
										categories.
									</p>
								)}
							</>
						)}
					</CardContent>
				</Card>

				{/* Accounts + top transactions */}
				<div className="space-y-4">
					<Card className="border-border/50 bg-card/50">
						<CardHeader>
							<CardTitle>Account Balances</CardTitle>
							<CardDescription>Current snapshot</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2.5">
							{accounts.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No accounts yet.
								</p>
							) : (
								accounts.map((account) => (
									<div
										key={account.id}
										className="flex items-center justify-between text-sm"
									>
										<span className="font-medium">{account.name}</span>
										<span className="font-mono">
											{formatCurrency(toNumber(account.balance))}
										</span>
									</div>
								))
							)}
						</CardContent>
					</Card>

					<Card className="border-border/50 bg-card/50">
						<CardHeader>
							<CardTitle>Transactions</CardTitle>
							<CardDescription>{periodLabel}</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2.5">
							{periodTransactionsSorted.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No transactions in this period.
								</p>
							) : (
								periodTransactionsSorted.slice(0, 8).map((t) => (
									<div
										key={t.id}
										className="flex items-center justify-between text-sm"
									>
										<div className="min-w-0">
											<p className="truncate font-medium">
												{t.description || t.category?.name || "Transaction"}
											</p>
											<p className="text-xs text-muted-foreground">
												{format(parseTransactionDate(t.date), "MMM d, yyyy")} ·{" "}
											{t.category?.name || t.type}
											</p>
										</div>
										<span
											className={cn(
												"ml-3 shrink-0 font-mono text-xs font-semibold tabular-nums",
												t.type === "income"
													? "text-[var(--income)]"
													: t.type === "expense"
														? "text-[var(--expense)]"
														: "text-muted-foreground",
											)}
										>
											{t.type === "income"
												? "+"
												: t.type === "expense"
													? "−"
													: "⇄"}
											{formatCurrency(toNumber(t.amount))}
										</span>
									</div>
								))
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
