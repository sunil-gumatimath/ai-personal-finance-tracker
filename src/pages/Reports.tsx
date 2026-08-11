import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import {
	ArrowLeft,
	ArrowRight,
	Download,
	FileText,
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
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import { api } from "@/lib/api-client";
import { downloadTransactionsCsv } from "@/lib/transaction-csv";
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

const toNumber = (value: unknown): number => {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
};

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

export function Reports() {
	const { user } = useAuth();
	const { formatCurrency } = usePreferences();
	const [loading, setLoading] = useState(true);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [viewMode, setViewMode] = useState<"month" | "year">("month");
	const [periodDate, setPeriodDate] = useState(() => new Date());
	const [exporting, setExporting] = useState(false);

	const fetchData = useCallback(async () => {
		if (!user) {
			setLoading(false);
			return;
		}
		try {
			const [transactionsRes, accountsRes] = await Promise.all([
				api.transactions.list({ limit: 1000 }),
				api.accounts.list(),
			]);
			setTransactions(
				(Array.isArray(transactionsRes.transactions)
					? transactionsRes.transactions
					: []) as Transaction[],
			);
			setAccounts(
				(Array.isArray(accountsRes.accounts)
					? accountsRes.accounts
					: []) as Account[],
			);
		} catch (error) {
			console.error("Error fetching report data:", error);
			toast.error("Failed to load report data");
		} finally {
			setLoading(false);
		}
	}, [user]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const inPeriod = useCallback(
		(t: Transaction): boolean => {
			if (viewMode === "month") {
				const d = new Date(t.date);
				return (
					d.getFullYear() === periodDate.getFullYear() &&
					d.getMonth() === periodDate.getMonth()
				);
			}
			const d = new Date(t.date);
			const now = new Date();
			return (
				d.getFullYear() === now.getFullYear() &&
				d.getMonth() >= now.getMonth() - 11 &&
				d.getMonth() <= now.getMonth()
			);
		},
		[viewMode, periodDate],
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
		const now = new Date();
		const points: MonthlyPoint[] = [];
		for (let i = 11; i >= 0; i--) {
			const monthDate = subMonths(now, i);
			const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
			let income = 0;
			let expenses = 0;
			for (const t of transactions) {
				const d = new Date(t.date);
				if (`${d.getFullYear()}-${d.getMonth()}` !== key) continue;
				if (t.type === "income") income += toNumber(t.amount);
				else if (t.type === "expense") expenses += toNumber(t.amount);
			}
			points.push({
				month: `${MONTH_LABELS[monthDate.getMonth()]} ${String(monthDate.getFullYear()).slice(2)}`,
				income: Math.round(income * 100) / 100,
				expenses: Math.round(expenses * 100) / 100,
			});
		}
		return points;
	}, [transactions]);

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

			const categoryRows = categorySpending.map((c) => [
				c.category,
				formatCurrency(c.amount),
				`${c.percentage.toFixed(1)}%`,
			]);
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

			{/* Period selector */}
			<div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:bg-card/80">
				<div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
				<div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2">
						<Button
							variant={viewMode === "month" ? "default" : "ghost"}
							size="sm"
							onClick={() => setViewMode("month")}
						>
							Month
						</Button>
						<Button
							variant={viewMode === "year" ? "default" : "ghost"}
							size="sm"
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
								onClick={() => shiftPeriod(-1)}
							>
								<ArrowLeft className="h-4 w-4" />
							</Button>
							<span className="w-36 text-center text-sm font-semibold">
								{periodLabel}
							</span>
							<Button
								variant="outline"
								size="icon"
								onClick={() => shiftPeriod(1)}
							>
								<ArrowRight className="h-4 w-4" />
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
						<p className="mt-2 text-2xl font-bold tracking-tight text-[var(--income)]">
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
						<p className="mt-2 text-2xl font-bold tracking-tight text-[var(--expense)]">
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
						<p className="mt-2 text-2xl font-bold tracking-tight">
							{formatCurrency(totals.net)}
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
								"mt-2 text-2xl font-bold tracking-tight",
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
							/>
							<ChartTooltip />
							<Area
								type="monotone"
								dataKey="income"
								stroke="var(--income)"
								fill="var(--income)"
								fillOpacity={0.15}
								strokeWidth={2}
							/>
							<Area
								type="monotone"
								dataKey="expenses"
								stroke="var(--expense)"
								fill="var(--expense)"
								fillOpacity={0.15}
								strokeWidth={2}
							/>
						</AreaChart>
					</ChartContainer>
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
										data={categorySpending.slice(0, 6)}
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
											{categorySpending.slice(0, 6).map((entry, index) => (
												<Cell
													key={entry.category}
													fill={
														CATEGORY_COLORS[index % CATEGORY_COLORS.length] ||
														entry.color
													}
												/>
											))}
										</Bar>
									</BarChart>
								</ChartContainer>
								<div className="mt-4 space-y-2.5">
									{categorySpending.slice(0, 6).map((entry) => (
										<div key={entry.category} className="space-y-1">
											<div className="flex items-center justify-between text-xs">
												<span className="font-medium">{entry.category}</span>
												<span className="text-muted-foreground">
													{formatCurrency(entry.amount)} ·{" "}
													{entry.percentage.toFixed(1)}%
												</span>
											</div>
											<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
												<div
													className="h-full rounded-full transition-all"
													style={{
														width: `${Math.min(entry.percentage, 100)}%`,
														backgroundColor: entry.color,
													}}
												/>
											</div>
										</div>
									))}
								</div>
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
												{t.date} · {t.category?.name || t.type}
											</p>
										</div>
										<span
											className={cn(
												"ml-3 shrink-0 font-mono text-xs font-semibold",
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
