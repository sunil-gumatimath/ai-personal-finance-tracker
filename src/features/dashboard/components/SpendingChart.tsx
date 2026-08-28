import { useState } from 'react'
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/hooks/usePreferences'
import { TrendingUp, TrendingDown, ChartLine } from 'lucide-react'
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/number'
import { currencyLocales } from '@/types/preferences'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

interface MonthlyTrend {
    month: string
    income: number
    expenses: number
}

interface SpendingChartProps {
    data: MonthlyTrend[]
    /** While the parent fetch is in flight — mirrors the loaded layout. */
    isLoading?: boolean
}

const chartConfig = {
    income: {
        label: 'Income',
        color: 'var(--income)',
    },
    expenses: {
        label: 'Expenses',
        color: 'var(--expense)',
    },
} satisfies ChartConfig

// Compact, currency-aware axis ticks (e.g. "$5k", "₹1.2L") using the user's locale.
const makeTickFormatter =
    (currency: string, locale: string) =>
    (value: number): string =>
        formatCompactCurrency(value, currency, locale)

// Custom Tooltip — hoisted out of the component body so it isn't recreated on
// every render (which forces Recharts to remount the tooltip layer).
interface TooltipEntry {
    dataKey?: string | number
    value?: number | string
}

interface CustomTooltipProps {
    active?: boolean
    payload?: TooltipEntry[]
    label?: string | number
    formatCurrency: (amount: number) => string
    showIncome: boolean
    showExpenses: boolean
}

const CustomTooltip = ({
    active,
    payload,
    label,
    formatCurrency,
    showIncome,
    showExpenses,
}: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null

    const income = Number(payload.find((p) => p.dataKey === 'income')?.value) || 0
    const expenses = Number(payload.find((p) => p.dataKey === 'expenses')?.value) || 0
    const net = income - expenses
    const monthSavingsRate = income > 0 ? (net / income) * 100 : 0

    // Solid popover surface to match BudgetOverview's tooltip.
    return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 min-w-[200px] flex flex-col gap-2 z-50">
            <div className="text-xs font-semibold text-muted-foreground border-b border-border pb-1.5 mb-0.5">
                {label} Overview
            </div>
            <div className="flex flex-col gap-1.5">
                {showIncome && (
                    <div className="flex items-center justify-between text-xs font-medium">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-[var(--income)]" />
                            Income
                        </div>
                        <span className="font-bold text-foreground font-mono">{formatCurrency(income)}</span>
                    </div>
                )}
                {showExpenses && (
                    <div className="flex items-center justify-between text-xs font-medium">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-[var(--expense)]" />
                            Expenses
                        </div>
                        <span className="font-bold text-foreground font-mono">{formatCurrency(expenses)}</span>
                    </div>
                )}
            </div>

            {(showIncome && showExpenses) && (
                <div className="border-t border-border pt-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">Net Flow</span>
                        <span className={cn(
                            "font-mono font-bold",
                            net >= 0 ? "text-[var(--income)]" : "text-[var(--expense)]"
                        )}>
                            {net >= 0 ? '+' : ''}{formatCurrency(net)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                        <span>Savings Rate</span>
                        <span>{monthSavingsRate >= 0 ? monthSavingsRate.toFixed(0) : 0}%</span>
                    </div>
                </div>
            )}
        </div>
    )
}

export function SpendingChart({ data, isLoading = false }: SpendingChartProps) {
    const { preferences, formatCurrency } = usePreferences()
    const [visibleSeries, setVisibleSeries] = useState({ income: true, expenses: true })

    const locale = currencyLocales[preferences.currency] || 'en-US'

    const toggleSeries = (series: 'income' | 'expenses') => {
        setVisibleSeries(prev => {
            // Prevent toggling both off to keep the chart meaningful
            if (series === 'income' && !prev.expenses && prev.income) return prev
            if (series === 'expenses' && !prev.income && prev.expenses) return prev
            return {
                ...prev,
                [series]: !prev[series]
            }
        })
    }

    const totalIncome = data.reduce((sum, item) => sum + item.income, 0)
    const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0)
    const netFlow = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? ((netFlow / totalIncome) * 100) : 0
    const hasNoData = totalIncome === 0 && totalExpenses === 0

    // Static accessible description — the encoding no longer varies.
    const chartAriaLabel = 'Area chart comparing monthly income and expenses over the last six months'

    return (
        <Card className="border border-border bg-card relative z-10">
            <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">Income vs Expenses</CardTitle>
                        <CardDescription className="text-xs">Last 6 months overview</CardDescription>
                    </div>
                    {!isLoading && (
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                            {/* Static summary pills — informational, so no hover/scale affordances */}
                            <div className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full border font-semibold",
                                netFlow >= 0
                                    ? "bg-[var(--income)]/10 text-[var(--income)] border-[var(--income)]/20"
                                    : "bg-[var(--expense)]/10 text-[var(--expense)] border-[var(--expense)]/20"
                            )}>
                                {netFlow >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                <span>{netFlow >= 0 ? 'Net Inflow' : 'Net Outflow'}: {formatCurrency(Math.abs(netFlow))}</span>
                            </div>
                            <div className="flex items-center gap-1 px-3 py-1 rounded-full border border-border/20 bg-muted/40 font-semibold text-muted-foreground">
                                <span>{savingsRate.toFixed(0)}% Savings Rate</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Interactive Toggles & Legend */}
                {!isLoading && (
                    <div className="flex items-center gap-3 pt-3 mt-1 border-t border-border/5">
                        {/* Series Toggles (Legend) */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => toggleSeries('income')}
                                aria-pressed={visibleSeries.income}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors duration-150 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    visibleSeries.income
                                        ? "bg-[var(--income)]/10 border-[var(--income)]/20 text-[var(--income)] font-semibold shadow-xs"
                                        : "bg-transparent border-transparent text-muted-foreground opacity-40 hover:opacity-75"
                                )}
                            >
                                <span className="h-2 w-2 rounded-full bg-[var(--income)]" />
                                Income
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleSeries('expenses')}
                                aria-pressed={visibleSeries.expenses}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors duration-150 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    visibleSeries.expenses
                                        ? "bg-[var(--expense)]/10 border-[var(--expense)]/20 text-[var(--expense)] font-semibold shadow-xs"
                                        : "bg-transparent border-transparent text-muted-foreground opacity-40 hover:opacity-75"
                                )}
                            >
                                <span className="h-2 w-2 rounded-full bg-[var(--expense)]" />
                                Expenses
                            </button>
                        </div>
                    </div>
                )}
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    /* Loading skeleton mirrors the ~300px chart block */
                    <div className="h-[300px] w-full rounded-xl bg-muted/30 p-4 flex flex-col justify-end gap-2" aria-hidden="true">
                        <div className="flex h-full items-end gap-3">
                            {[45, 70, 55, 85, 60, 75].map((h, i) => (
                                <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
                            ))}
                        </div>
                    </div>
                ) : hasNoData ? (
                    /* Empty state: all-zero data is NOT a chart */
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-5 bg-muted/50 rounded-full p-6">
                            <ChartLine className="h-12 w-12 text-muted-foreground/60" />
                        </div>
                        <p className="text-sm font-medium mb-1">No activity in the last 6 months</p>
                        <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
                            Add a transaction to see your income and expenses charted here.
                        </p>
                        <Link
                            to="/transactions?action=new"
                            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary/90 active:scale-[0.98]"
                        >
                            <Plus className="h-4 w-4" />
                            Add your first transaction
                        </Link>
                    </div>
                ) : (
                    <ChartContainer
                        config={chartConfig}
                        className="aspect-auto h-[300px] w-full"
                        role="img"
                        aria-label={chartAriaLabel}
                    >
                        <AreaChart
                            data={data}
                            margin={{ top: 20, right: 10, left: -10, bottom: 16 }}
                        >
                            <defs>
                                <linearGradient id="fillIncomeStep" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="fillExpensesStep" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
                            <XAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={makeTickFormatter(preferences.currency, locale)}
                                tickMargin={10}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                            />
                            <ChartTooltip
                                content={
                                    <CustomTooltip
                                        formatCurrency={formatCurrency}
                                        showIncome={visibleSeries.income}
                                        showExpenses={visibleSeries.expenses}
                                    />
                                }
                            />

                            {visibleSeries.income && (
                                <Area
                                    dataKey="income"
                                    type="step"
                                    fill="url(#fillIncomeStep)"
                                    stroke="var(--color-income)"
                                    strokeWidth={2}
                                    activeDot={{
                                        r: 5,
                                        fill: "var(--color-income)",
                                        stroke: "hsl(var(--background))",
                                        strokeWidth: 2,
                                    }}
                                />
                            )}
                            {visibleSeries.expenses && (
                                <Area
                                    dataKey="expenses"
                                    type="step"
                                    fill="url(#fillExpensesStep)"
                                    stroke="var(--color-expenses)"
                                    strokeWidth={2}
                                    activeDot={{
                                        r: 5,
                                        fill: "var(--color-expenses)",
                                        stroke: "hsl(var(--background))",
                                        strokeWidth: 2,
                                    }}
                                />
                            )}
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}
