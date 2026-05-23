import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/hooks/usePreferences'
import { TrendingUp, TrendingDown } from 'lucide-react'
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
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
        color: 'hsl(142.1 76.2% 36.3%)',
    },
    expenses: {
        label: 'Expenses',
        color: 'hsl(346.8 77.2% 49.8%)',
    },
} satisfies ChartConfig

export function SpendingChart({ data }: SpendingChartProps) {
    const { formatCurrency } = usePreferences()

    const totalIncome = data.reduce((sum, item) => sum + item.income, 0)
    const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0)
    const netFlow = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? ((netFlow / totalIncome) * 100) : 0

    return (
        <Card className="border border-border bg-card">
            <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">Income vs Expenses</CardTitle>
                        <CardDescription className="text-xs">Last 6 months overview</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                        <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-full border font-semibold",
                            netFlow >= 0 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        )}>
                            {netFlow >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                            <span>{netFlow >= 0 ? 'Net Inflow' : 'Net Outflow'}: {formatCurrency(Math.abs(netFlow))}</span>
                        </div>
                        <div className="flex items-center gap-1 px-3 py-1 rounded-full border border-border/20 bg-muted/40 font-semibold text-muted-foreground/90">
                            <span>{savingsRate.toFixed(0)}% Savings Rate</span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <AreaChart
                        data={data}
                        margin={{ top: 20, right: 10, left: -10, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.4} />
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
                        <ChartTooltip
                            content={
                                <ChartTooltipContent
                                    indicator="dot"
                                    className="premium-glass border-border/40 min-w-[140px] rounded-xl shadow-xl p-2.5"
                                    formatter={(value, name) => (
                                        <div className="flex items-center justify-between gap-8 text-xs font-semibold">
                                            <span className="text-muted-foreground capitalize">{name}</span>
                                            <span className="font-bold text-foreground">{formatCurrency(Number(value))}</span>
                                        </div>
                                    )}
                                />
                            }
                        />
                        <Area
                            dataKey="income"
                            type="natural"
                            fill="url(#fillIncome)"
                            stroke="var(--color-income)"
                            strokeWidth={2}
                            activeDot={{
                                r: 5,
                                fill: "var(--color-income)",
                                stroke: "hsl(var(--background))",
                                strokeWidth: 2,
                            }}
                        />
                        <Area
                            dataKey="expenses"
                            type="natural"
                            fill="url(#fillExpenses)"
                            stroke="var(--color-expenses)"
                            strokeWidth={2}
                            activeDot={{
                                r: 5,
                                fill: "var(--color-expenses)",
                                stroke: "hsl(var(--background))",
                                strokeWidth: 2,
                            }}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
