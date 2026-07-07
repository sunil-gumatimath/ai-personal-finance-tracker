import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/hooks/usePreferences'
import { TrendingUp, TrendingDown } from 'lucide-react'
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'

interface MonthlyTrend {
    month: string
    income: number
    expenses: number
}

interface SpendingChartProps {
    data: MonthlyTrend[]
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

export function SpendingChart({ data }: SpendingChartProps) {
    const { formatCurrency } = usePreferences()
    const [chartType, setChartType] = useState<'bar' | 'line' | 'step'>('step')
    const [visibleSeries, setVisibleSeries] = useState({ income: true, expenses: true })

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

    // Custom Tooltip component to show detailed metrics per month
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const income = payload.find((p: any) => p.dataKey === 'income')?.value || 0
            const expenses = payload.find((p: any) => p.dataKey === 'expenses')?.value || 0
            const net = income - expenses
            const monthSavingsRate = income > 0 ? (net / income) * 100 : 0

            return (
                <div className="premium-glass border border-border/40 min-w-[200px] rounded-xl shadow-xl p-4 flex flex-col gap-2.5 animate-fade-in-up z-50">
                    <div className="text-xs font-semibold text-muted-foreground/80 border-b border-border/20 pb-1.5 mb-0.5">
                        {label} Overview
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {visibleSeries.income && (
                            <div className="flex items-center justify-between text-xs font-medium">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <span className="h-2 w-2 rounded-full bg-[var(--income)]" />
                                    Income
                                </div>
                                <span className="font-bold text-foreground font-mono">{formatCurrency(income)}</span>
                            </div>
                        )}
                        {visibleSeries.expenses && (
                            <div className="flex items-center justify-between text-xs font-medium">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <span className="h-2 w-2 rounded-full bg-[var(--expense)]" />
                                    Expenses
                                </div>
                                <span className="font-bold text-foreground font-mono">{formatCurrency(expenses)}</span>
                            </div>
                        )}
                    </div>
                    
                    {(visibleSeries.income && visibleSeries.expenses) && (
                        <div className="border-t border-border/20 pt-2 flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-muted-foreground">Net Flow</span>
                                <span className={cn(
                                    "font-mono font-bold",
                                    net >= 0 ? "text-emerald-400" : "text-rose-400"
                                )}>
                                    {net >= 0 ? '+' : ''}{formatCurrency(net)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground/90">
                                <span>Savings Rate</span>
                                <span>{monthSavingsRate >= 0 ? monthSavingsRate.toFixed(0) : 0}%</span>
                            </div>
                        </div>
                    )}
                </div>
            )
        }
        return null
    }

    return (
        <Card className="border border-border bg-card relative z-10">
            <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">Income vs Expenses</CardTitle>
                        <CardDescription className="text-xs">Last 6 months overview</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                        <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-full border font-semibold transition-all duration-300 hover:scale-[1.02]",
                            netFlow >= 0 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        )}>
                            {netFlow >= 0 ? <TrendingUp className="h-3.5 w-3.5 animate-pulse" /> : <TrendingDown className="h-3.5 w-3.5 animate-pulse" />}
                            <span>{netFlow >= 0 ? 'Net Inflow' : 'Net Outflow'}: {formatCurrency(Math.abs(netFlow))}</span>
                        </div>
                        <div className="flex items-center gap-1 px-3 py-1 rounded-full border border-border/20 bg-muted/40 font-semibold text-muted-foreground/90 transition-all duration-300 hover:scale-[1.02]">
                            <span>{savingsRate.toFixed(0)}% Savings Rate</span>
                        </div>
                    </div>
                </div>

                {/* Interactive Toggles & Legend */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-1 border-t border-border/5">
                    {/* Series Toggles (Legend) */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => toggleSeries('income')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 active:scale-97 cursor-pointer",
                                visibleSeries.income
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-semibold shadow-xs"
                                    : "bg-transparent border-transparent text-muted-foreground opacity-40 hover:opacity-75"
                            )}
                        >
                            <span className="h-2 w-2 rounded-full bg-[var(--income)] shadow-sm shadow-[var(--income)]" />
                            Income
                        </button>
                        <button
                            onClick={() => toggleSeries('expenses')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 active:scale-97 cursor-pointer",
                                visibleSeries.expenses
                                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400 font-semibold shadow-xs"
                                    : "bg-transparent border-transparent text-muted-foreground opacity-40 hover:opacity-75"
                            )}
                        >
                            <span className="h-2 w-2 rounded-full bg-[var(--expense)] shadow-sm shadow-[var(--expense)]" />
                            Expenses
                        </button>
                    </div>

                    {/* Chart Type Selector */}
                    <div className="flex items-center gap-1 self-start sm:self-auto rounded-lg bg-muted/50 p-1 border border-border/30">
                        <button
                            onClick={() => setChartType('bar')}
                            className={cn(
                                "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-97 cursor-pointer",
                                chartType === 'bar'
                                    ? "bg-background text-foreground shadow-xs font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Bar
                        </button>
                        <button
                            onClick={() => setChartType('line')}
                            className={cn(
                                "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-97 cursor-pointer",
                                chartType === 'line'
                                    ? "bg-background text-foreground shadow-xs font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Line
                        </button>
                        <button
                            onClick={() => setChartType('step')}
                            className={cn(
                                "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-97 cursor-pointer",
                                chartType === 'step'
                                    ? "bg-background text-foreground shadow-xs font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Step
                        </button>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent>
                <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
                    {chartType === 'step' ? (
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
                                tickFormatter={(value) => {
                                    if (value === 0) return '0'
                                    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`
                                    return value.toString()
                                }}
                                tickMargin={10}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                            />
                            <ChartTooltip content={<CustomTooltip />} />
                            
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
                    ) : chartType === 'bar' ? (
                        <BarChart
                            data={data}
                            margin={{ top: 20, right: 10, left: -10, bottom: 16 }}
                        >
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
                                tickFormatter={(value) => {
                                    if (value === 0) return '0'
                                    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`
                                    return value.toString()
                                }}
                                tickMargin={10}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                            />
                            <ChartTooltip content={<CustomTooltip />} />
                            
                            {visibleSeries.income && (
                                <Bar
                                    dataKey="income"
                                    fill="var(--color-income)"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={32}
                                    animationDuration={400}
                                />
                            )}
                            {visibleSeries.expenses && (
                                <Bar
                                    dataKey="expenses"
                                    fill="var(--color-expenses)"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={32}
                                    animationDuration={400}
                                />
                            )}
                        </BarChart>
                    ) : (
                        <LineChart
                            data={data}
                            margin={{ top: 20, right: 10, left: -10, bottom: 16 }}
                        >
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
                                tickFormatter={(value) => {
                                    if (value === 0) return '0'
                                    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`
                                    return value.toString()
                                }}
                                tickMargin={10}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                            />
                            <ChartTooltip content={<CustomTooltip />} />
                            
                            {visibleSeries.income && (
                                <Line
                                    dataKey="income"
                                    type="natural"
                                    stroke="var(--color-income)"
                                    strokeWidth={2.5}
                                    dot={{
                                        r: 3.5,
                                        fill: "var(--color-income)",
                                        strokeWidth: 0,
                                    }}
                                    activeDot={{
                                        r: 5.5,
                                        fill: "var(--color-income)",
                                        stroke: "hsl(var(--background))",
                                        strokeWidth: 2,
                                    }}
                                    animationDuration={400}
                                />
                            )}
                            {visibleSeries.expenses && (
                                <Line
                                    dataKey="expenses"
                                    type="natural"
                                    stroke="var(--color-expenses)"
                                    strokeWidth={2.5}
                                    dot={{
                                        r: 3.5,
                                        fill: "var(--color-expenses)",
                                        strokeWidth: 0,
                                    }}
                                    activeDot={{
                                        r: 5.5,
                                        fill: "var(--color-expenses)",
                                        stroke: "hsl(var(--background))",
                                        strokeWidth: 2,
                                    }}
                                    animationDuration={400}
                                />
                            )}
                        </LineChart>
                    )}
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
