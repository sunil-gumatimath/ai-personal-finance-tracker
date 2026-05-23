import { useState } from 'react'
import { Pie, PieChart, Cell, ResponsiveContainer, Sector, type TooltipProps } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/hooks/usePreferences'
import type { SpendingByCategory } from '@/types'
import { PieChartIcon, TrendingDown, TrendingUp, ArrowRight, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
} from '@/components/ui/chart'

interface BudgetOverviewProps {
    spendingByCategory: SpendingByCategory[]
    previousMonthData?: SpendingByCategory[]
}

type ChartDatum = {
    category: string
    amount: number
    percentage: number
    fill: string
}

type ActiveShapeProps = {
    cx: number
    cy: number
    innerRadius: number
    outerRadius: number
    startAngle: number
    endAngle: number
    fill: string
    payload: ChartDatum
    percent: number
}

const COLORS = [
    'hsl(346.8 77.2% 49.8%)', // Rose
    'hsl(142.1 76.2% 36.3%)', // Green
    'hsl(221.2 83.2% 53.3%)', // Blue
    'hsl(262.1 83.3% 57.8%)', // Purple
    'hsl(24.6 95% 53.1%)',    // Orange
    'hsl(47.9 95.8% 53.1%)',  // Yellow
    'hsl(173.4 80.4% 40%)',   // Teal
    'hsl(280 65.3% 60%)',     // Violet
    'hsl(340 75.5% 55%)',     // Pink
    'hsl(200 80% 50%)',       // Cyan
    'hsl(15 80% 55%)',        // Coral
    'hsl(60 70% 45%)',        // Olive
]

// Custom active shape for enhanced hover effect
const renderActiveShape = (props: unknown) => {
    const {
        cx, cy, innerRadius, outerRadius, startAngle, endAngle,
        fill, payload, percent
    } = props as ActiveShapeProps

    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius - 4}
                outerRadius={outerRadius + 8}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                style={{
                    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
                    transition: 'all 0.3s ease-out'
                }}
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 10}
                outerRadius={outerRadius + 14}
                fill={fill}
                opacity={0.6}
            />
            <text
                x={cx}
                y={cy - 12}
                textAnchor="middle"
                className="fill-foreground text-2xl font-bold"
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
            <text
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                className="fill-muted-foreground text-sm"
            >
                {payload.category}
            </text>
        </g>
    )
}

// Custom tooltip component
type CustomTooltipProps = TooltipProps<number, string> & {
    formatCurrency: (amount: number) => string
}

const CustomTooltip = ({ active, payload, formatCurrency }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        const data = payload[0]?.payload as ChartDatum
        return (
            <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 min-w-[160px]">
                <div className="flex items-center gap-2 mb-2">
                    <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: data.fill }}
                    />
                    <span className="font-medium text-sm">{data.category}</span>
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Amount</span>
                        <span className="font-semibold text-sm">{formatCurrency(data.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Share</span>
                        <span className="font-medium text-sm">{data.percentage.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        )
    }
    return null
}

export function BudgetOverview({ spendingByCategory, previousMonthData }: BudgetOverviewProps) {
    const { formatCurrency } = usePreferences()
    const [activeIndex, setActiveIndex] = useState<number | undefined>(0)

    const totalSpending = spendingByCategory.reduce((sum, cat) => sum + cat.amount, 0)
    const topCategories = spendingByCategory.slice(0, 5)

    // Get previous month spending for comparison
    const getPreviousMonthAmount = (category: string): number => {
        if (!previousMonthData) return 0
        const prevCat = previousMonthData.find(c => c.category === category)
        return prevCat?.amount || 0
    }

    // Calculate spending change for a category
    const getSpendingChange = (category: string, currentAmount: number): { percent: number; direction: 'up' | 'down' | 'same' } => {
        const prevAmount = getPreviousMonthAmount(category)
        if (prevAmount === 0) return { percent: 0, direction: 'same' }
        const change = ((currentAmount - prevAmount) / prevAmount) * 100
        return {
            percent: Math.abs(change),
            direction: change > 5 ? 'up' : change < -5 ? 'down' : 'same'
        }
    }

    // Prepare chart data with colors
    const chartData = spendingByCategory.map((cat, index) => ({
        category: cat.category,
        amount: cat.amount,
        percentage: cat.percentage,
        fill: cat.color || COLORS[index % COLORS.length],
    }))

    const chartConfig = {
        amount: { label: 'Amount' },
        ...spendingByCategory.reduce((acc, cat, index) => {
            acc[cat.category] = {
                label: cat.category,
                color: cat.color || COLORS[index % COLORS.length]
            }
            return acc
        }, {} as ChartConfig)
    } satisfies ChartConfig

    const onPieEnter = (_: unknown, index: number) => {
        setActiveIndex(index)
    }

    const onPieLeave = () => {
        setActiveIndex(0)
    }

    // Empty state with enhanced visuals
    if (spendingByCategory.length === 0) {
        return (
            <Card className="h-full flex flex-col overflow-hidden">
                <CardHeader className="items-center pb-0">
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Spending Flow
                    </CardTitle>
                    <CardDescription>Category breakdown</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
                        <div className="relative bg-muted/50 rounded-full p-6">
                            <PieChartIcon className="h-12 w-12 text-muted-foreground/60" />
                        </div>
                    </div>
                    <p className="text-sm font-medium mb-1">No spending data yet</p>
                    <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
                        Start tracking your expenses to see your spending patterns visualized here.
                    </p>
                    <Button asChild size="sm" variant="outline" className="gap-2">
                        <Link to="/transactions?action=new">
                            <Plus className="h-4 w-4" />
                            Add First Expense
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full flex flex-col overflow-hidden border border-border bg-card">
            <CardHeader className="items-center pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    Spending Flow
                </CardTitle>
                <CardDescription className="text-xs">This month's expense breakdown</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                    {/* Pie Chart Section */}
                    <div className="flex items-center justify-center">
                        <ChartContainer
                            config={chartConfig}
                            className="w-full aspect-square max-h-[220px]"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <ChartTooltip
                                        content={<CustomTooltip formatCurrency={formatCurrency} />}
                                    />
                                    <Pie
                                        data={chartData}
                                        dataKey="amount"
                                        nameKey="category"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={3}
                                        animationBegin={0}
                                        animationDuration={800}
                                        animationEasing="ease-out"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.fill}
                                                stroke="hsl(var(--background))"
                                                strokeWidth={2}
                                            />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </div>

                    {/* Category Legend Section */}
                    <div className="flex flex-col justify-center space-y-2 py-2">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                            Top Categories
                        </div>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                            {topCategories.map((cat, index) => {
                                const change = getSpendingChange(cat.category, cat.amount)
                                const color = cat.color || COLORS[index % COLORS.length]

                                return (
                                    <div
                                        key={cat.category}
                                        className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent"
                                    >
                                        {/* Color indicator with no effects */}
                                        <div className="relative">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: color }}
                                            />
                                        </div>

                                        {/* Category info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold truncate text-foreground">
                                                    {cat.category}
                                                </span>
                                                <span className="text-xs font-bold tabular-nums">
                                                    {formatCurrency(cat.amount)}
                                                </span>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden border border-border/10">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700 ease-[var(--ease-out-custom)]"
                                                        style={{
                                                            width: `${cat.percentage}%`,
                                                            backgroundColor: color,
                                                            boxShadow: `0 0 8px ${color}20`
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-bold text-muted-foreground/75 tabular-nums w-10 text-right">
                                                    {cat.percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Trend indicator */}
                                        {change.direction !== 'same' && (
                                            <div className={cn(
                                                "flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors",
                                                change.direction === 'up'
                                                    ? "text-red-500 bg-red-500/10 border-red-500/20"
                                                    : "text-green-500 bg-green-500/10 border-green-500/20"
                                            )}>
                                                {change.direction === 'up'
                                                    ? <TrendingUp className="h-3 w-3" />
                                                    : <TrendingDown className="h-3 w-3" />
                                                }
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* More categories indicator */}
                        {spendingByCategory.length > 5 && (
                            <div className="text-[10px] font-bold text-muted-foreground/70 text-center pt-1 uppercase tracking-wider">
                                +{spendingByCategory.length - 5} more categories
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>

            {/* Enhanced Footer */}
            <div className="border-t border-border/30 px-6 py-3 bg-muted/15 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-muted border border-border/30">
                                <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs font-bold">{formatCurrency(totalSpending)}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total spent</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-border/40" />
                        <div>
                            <p className="text-xs font-bold">{chartData.length}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Categories</p>
                        </div>
                    </div>
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs hover:text-primary active:scale-95 font-medium rounded-lg"
                    >
                        <Link to="/categories">
                            View All
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                    </Button>
                </div>
            </div>
        </Card>
    )
}
