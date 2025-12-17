import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/hooks/usePreferences'
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from '@/components/ui/chart'

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
        color: 'oklch(0.646 0.222 153.212)', // var(--income) emerald-500 equivalent
    },
    expenses: {
        label: 'Expenses',
        color: 'oklch(0.577 0.245 27.325)', // var(--expense) rose-500 equivalent
    },
} satisfies ChartConfig

export function SpendingChart({ data }: SpendingChartProps) {
    const { formatCurrency } = usePreferences()

    // Calculate totals for summary
    const totalIncome = data.reduce((sum, item) => sum + item.income, 0)
    const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0)
    const netFlow = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? ((netFlow / totalIncome) * 100).toFixed(0) : '0'

    return (
        <Card className="relative border border-border/50 bg-card/50 backdrop-blur-xl shadow-xl overflow-hidden h-full flex flex-col group/chart">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-rose-500/[0.03] pointer-events-none opacity-50 group-hover/chart:opacity-100 transition-opacity duration-700" />
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/[0.05] rounded-full blur-[100px] pointer-events-none animate-pulse" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-rose-500/[0.05] rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

            <CardHeader className="relative pb-2 shrink-0 border-b border-border/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/10 blur-lg rounded-xl" />
                            <div className="relative p-2.5 rounded-xl bg-primary/10 text-primary border border-border/50 shadow-sm">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black tracking-tight text-foreground">
                                Income vs Expenses
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/80">
                                    Last 6 months
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={`group/stat flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-md transition-all duration-300 ${netFlow >= 0
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 shadow-sm'}`}>
                            {netFlow >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            <span className="font-black text-sm tabular-nums tracking-tighter">{formatCurrency(Math.abs(netFlow))}</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border/50 bg-secondary/30 backdrop-blur-md text-primary shadow-sm">
                            <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Savings</span>
                            <span className="font-black text-sm tabular-nums">{savingsRate}%</span>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="relative flex-1 flex flex-col min-h-0 pt-4 pb-4">
                <ChartContainer config={chartConfig} className="w-full aspect-auto h-[250px]">
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-income)" stopOpacity={0.4} />
                                <stop offset="50%" stopColor="var(--color-income)" stopOpacity={0.1} />
                                <stop offset="100%" stopColor="var(--color-income)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-expenses)" stopOpacity={0.3} />
                                <stop offset="50%" stopColor="var(--color-expenses)" stopOpacity={0.05} />
                                <stop offset="100%" stopColor="var(--color-expenses)" stopOpacity={0} />
                            </linearGradient>

                            <filter id="incomeGlow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="5" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                            <filter id="expenseGlow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="5" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                        </defs>

                        <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            opacity={0.3}
                            className="stroke-border"
                        />

                        <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{
                                fill: 'hsl(var(--muted-foreground))',
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: '0.05em'
                            }}
                            padding={{ left: 20, right: 20 }}
                            dy={15}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{
                                fill: 'hsl(var(--muted-foreground))',
                                fontSize: 11,
                                fontWeight: 600
                            }}
                            tickFormatter={(value) => {
                                if (value === 0) return '0'
                                if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`
                                return value.toString()
                            }}
                            width={60}
                        />


                        <ChartTooltip
                            content={<ChartTooltipContent
                                indicator="line"
                                labelFormatter={(label) => <span className="font-black uppercase tracking-widest">{label}</span>}
                                formatter={(value, name) => (
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-muted-foreground mr-6 uppercase text-[10px] font-bold tracking-wider">{name}</span>
                                        <span className={name === 'Income' ? 'text-emerald-500 font-black' : 'text-rose-500 font-black'}>
                                            {formatCurrency(Number(value))}
                                        </span>
                                    </div>
                                )}
                            />}
                        />

                        <Area
                            type="monotone"
                            dataKey="income"
                            stroke="var(--color-income)"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#incomeGradient)"
                            activeDot={{
                                r: 6,
                                strokeWidth: 2,
                                stroke: 'hsl(var(--background))',
                                fill: 'var(--color-income)',
                                style: { filter: 'url(#incomeGlow)' }
                            }}
                            className="drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                            animationDuration={2000}
                        />

                        <Area
                            type="monotone"
                            dataKey="expenses"
                            stroke="var(--color-expenses)"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#expenseGradient)"
                            activeDot={{
                                r: 6,
                                strokeWidth: 2,
                                stroke: 'hsl(var(--background))',
                                fill: 'var(--color-expenses)',
                                style: { filter: 'url(#expenseGlow)' }
                            }}
                            className="drop-shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                            animationDuration={2000}
                        />
                        <ChartLegend content={<ChartLegendContent className="mt-8" />} />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
