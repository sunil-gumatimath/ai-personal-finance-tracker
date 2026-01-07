import { useState } from 'react'
import { Pie, PieChart, Cell, ResponsiveContainer, Sector } from 'recharts'
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
const renderActiveShape = (props: any) => {
    const {
        cx, cy, innerRadius, outerRadius, startAngle, endAngle,
        fill, payload, percent
    } = props

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
const CustomTooltip = ({ active, payload, formatCurrency }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload
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

    const onPieEnter = (_: any, index: number) => {
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
        <Card className="h-full flex flex-col overflow-hidden">
            <CardHeader className="items-center pb-2">
                <CardTitle className="flex items-center gap-2">
                    Spending Flow
                </CardTitle>
                <CardDescription>This month's expense breakdown</CardDescription>
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
                                        activeIndex={activeIndex}
                                        activeShape={renderActiveShape}
                                        onMouseEnter={onPieEnter}
                                        onMouseLeave={onPieLeave}
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
                                                style={{
                                                    transition: 'all 0.2s ease-out',
                                                    cursor: 'pointer',
                                                }}
                                            />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </div>

                    {/* Category Legend Section */}
                    <div className="flex flex-col justify-center space-y-2 py-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Top Categories
                        </div>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                            {topCategories.map((cat, index) => {
                                const change = getSpendingChange(cat.category, cat.amount)
                                const color = cat.color || COLORS[index % COLORS.length]
                                const isActive = activeIndex === spendingByCategory.findIndex(c => c.category === cat.category)

                                return (
                                    <div
                                        key={cat.category}
                                        className={cn(
                                            "group flex items-center gap-3 p-2 rounded-lg transition-all duration-200 cursor-pointer",
                                            "hover:bg-muted/50",
                                            isActive && "bg-muted/70 ring-1 ring-border"
                                        )}
                                        onMouseEnter={() => setActiveIndex(spendingByCategory.findIndex(c => c.category === cat.category))}
                                        onMouseLeave={() => setActiveIndex(0)}
                                    >
                                        {/* Color indicator with glow effect */}
                                        <div className="relative">
                                            <div
                                                className="absolute inset-0 rounded-full blur-sm opacity-50"
                                                style={{ backgroundColor: color }}
                                            />
                                            <div
                                                className="relative w-3 h-3 rounded-full ring-2 ring-background"
                                                style={{ backgroundColor: color }}
                                            />
                                        </div>

                                        {/* Category info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium truncate">
                                                    {cat.category}
                                                </span>
                                                <span className="text-sm font-semibold tabular-nums">
                                                    {formatCurrency(cat.amount)}
                                                </span>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500 ease-out"
                                                        style={{
                                                            width: `${cat.percentage}%`,
                                                            backgroundColor: color,
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                                                    {cat.percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Trend indicator */}
                                        {change.direction !== 'same' && (
                                            <div className={cn(
                                                "flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded",
                                                change.direction === 'up'
                                                    ? "text-red-500 bg-red-500/10"
                                                    : "text-green-500 bg-green-500/10"
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
                            <div className="text-xs text-muted-foreground text-center pt-1">
                                +{spendingByCategory.length - 5} more categories
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>

            {/* Enhanced Footer */}
            <div className="border-t border-border/50 px-6 py-3 bg-muted/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-semibold">{formatCurrency(totalSpending)}</p>
                                <p className="text-xs text-muted-foreground">Total spent</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-border/50" />
                        <div>
                            <p className="text-sm font-semibold">{chartData.length}</p>
                            <p className="text-xs text-muted-foreground">Categories</p>
                        </div>
                    </div>
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs hover:text-primary"
                    >
                        <Link to="/categories">
                            View All
                            <ArrowRight className="h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            </div>
        </Card>
    )
}
