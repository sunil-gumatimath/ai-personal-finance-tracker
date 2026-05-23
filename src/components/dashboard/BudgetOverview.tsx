import { Pie, PieChart, Cell, ResponsiveContainer, Label } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/hooks/usePreferences'
import type { SpendingByCategory } from '@/types'
import { PieChartIcon, TrendingDown, TrendingUp, ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
    type ChartConfig,
    ChartContainer,
} from '@/components/ui/chart'

interface BudgetOverviewProps {
    spendingByCategory: SpendingByCategory[]
    previousMonthData?: SpendingByCategory[]
}

const COLORS = [
    'hsl(244 75% 64%)', // Indigo (largest)
    'hsl(173 70% 41%)', // Teal (2nd)
    'hsl(352 85% 62%)', // Rose (3rd)
    'hsl(38 90% 55%)',  // Amber (4th)
    'hsl(265 80% 63%)', // Violet (5th)
    'hsl(199 85% 52%)', // Sky Blue
    'hsl(142 65% 44%)', // Mint/Green
    'hsl(24 85% 56%)',  // Warm Orange
    'hsl(292 75% 58%)', // Orchid Purple
    'hsl(215 20% 52%)', // Muted Slate
]


export function BudgetOverview({ spendingByCategory, previousMonthData }: BudgetOverviewProps) {
    const { formatCurrency } = usePreferences()

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

    // Map standard generic category hex colors to our custom premium HSL equivalents
    const getCategoryColor = (catColor: string | undefined, idx: number): string => {
        if (!catColor) return COLORS[idx % COLORS.length]
        const lowerColor = catColor.toLowerCase()
        switch (lowerColor) {
            case '#22c55e': return 'hsl(142 65% 44%)' // Mint Green
            case '#ef4444': return 'hsl(352 85% 62%)' // Premium Rose
            case '#3b82f6': return 'hsl(224 85% 64%)' // Slate Blue
            case '#f59e0b': return 'hsl(38 90% 55%)'  // Amber Gold
            case '#8b5cf6': return 'hsl(265 80% 63%)' // Violet Purple
            case '#ec4899': return 'hsl(326 70% 56%)' // Orchid Pink
            case '#06b6d4': return 'hsl(180 70% 41%)' // Sea Teal
            case '#84cc16': return 'hsl(84 65% 45%)'  // Lime Sage
            case '#f97316': return 'hsl(24 85% 56%)'  // Warm Orange
            case '#6366f1': return 'hsl(239 84% 67%)' // Slate Indigo
            default: return catColor
        }
    }

    // Prepare chart data with colors
    const chartData = spendingByCategory.map((cat, index) => ({
        category: cat.category,
        amount: cat.amount,
        percentage: cat.percentage,
        fill: getCategoryColor(cat.color, index),
    }))

    const chartConfig = {
        amount: { label: 'Amount' },
        ...spendingByCategory.reduce((acc, cat, index) => {
            acc[cat.category] = {
                label: cat.category,
                color: getCategoryColor(cat.color, index)
            }
            return acc
        }, {} as ChartConfig)
    } satisfies ChartConfig

    // Empty state with enhanced visuals
    if (spendingByCategory.length === 0) {
        return (
            <Card className="h-full flex flex-col overflow-hidden">
                <CardHeader className="items-center pb-0">
                    <CardTitle className="flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5 text-primary" />
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
                    {/* Donut Chart Section */}
                    <div className="flex items-center justify-center">
                        <ChartContainer
                            config={chartConfig}
                            className="w-full aspect-square max-h-[220px]"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        dataKey="amount"
                                        nameKey="category"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={80}
                                        paddingAngle={3}
                                        animationBegin={0}
                                        animationDuration={600}
                                        animationEasing="ease-out"
                                    >
                                        <Label
                                            content={({ viewBox }) => {
                                                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                                    return (
                                                        <text
                                                            x={viewBox.cx}
                                                            y={viewBox.cy}
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                        >
                                                            <tspan
                                                                x={viewBox.cx}
                                                                y={viewBox.cy ? viewBox.cy - 4 : 0}
                                                                className="fill-foreground text-sm font-bold font-sans"
                                                            >
                                                                {formatCurrency(totalSpending)}
                                                            </tspan>
                                                            <tspan
                                                                x={viewBox.cx}
                                                                y={viewBox.cy ? viewBox.cy + 14 : 0}
                                                                className="fill-muted-foreground text-[10px] font-bold uppercase tracking-wider font-sans"
                                                            >
                                                                Total Spent
                                                            </tspan>
                                                        </text>
                                                    )
                                                }
                                                return null
                                            }}
                                            position="center"
                                        />
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
                                const color = getCategoryColor(cat.color, index)

                                return (
                                    <div
                                        key={cat.category}
                                        className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent"
                                    >
                                        {/* Color indicator dot */}
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
                                                            boxShadow: `0 0 8px ${color}15`
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
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-px bg-border/40 mx-2" />
                            <div>
                                <p className="text-xs font-bold">{chartData.length}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Categories</p>
                            </div>
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
