import { PieChart, Pie, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/hooks/usePreferences'
import type { SpendingByCategory } from '@/types'
import { TrendingDown, Sparkles } from 'lucide-react'
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart'

interface BudgetOverviewProps {
    spendingByCategory: SpendingByCategory[]
}

const COLORS = [
    '#f43f5e', // rose
    '#10b981', // emerald
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
]

export function BudgetOverview({ spendingByCategory }: BudgetOverviewProps) {
    const { formatCurrency } = usePreferences()

    // Calculate total spending
    const totalSpending = spendingByCategory.reduce((sum, cat) => sum + cat.amount, 0)

    // Create chart config from data
    const chartConfig = spendingByCategory.reduce((acc, cat, index) => {
        acc[cat.category] = {
            label: cat.category,
            color: cat.color || COLORS[index % COLORS.length]
        }
        return acc
    }, {} as ChartConfig)

    if (spendingByCategory.length === 0) {
        return (
            <Card className="border border-border/50 bg-card/50 backdrop-blur-xl shadow-xl h-full overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent" />
                <CardHeader className="relative pb-2">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm transition-transform group-hover:scale-110">
                            <TrendingDown className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-black tracking-tight">Spending Flow</CardTitle>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/80">Category Analysis</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="relative flex flex-col items-center justify-center py-20 text-center">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-primary/10 blur-[30px] rounded-full scale-150" />
                        <div className="relative p-5 rounded-2xl bg-secondary border border-border/50 shadow-inner text-muted-foreground/40">
                            <Sparkles className="h-10 w-10" />
                        </div>
                    </div>
                    <h3 className="text-base font-black tracking-tight mb-1">No output detected</h3>
                    <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                        Execute some transactions to see your financial distribution.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border border-border/50 bg-card/50 backdrop-blur-xl shadow-xl h-full flex flex-col overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent" />
            <CardHeader className="relative pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm transition-transform group-hover:scale-110">
                            <TrendingDown className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-black tracking-tight">Spending Flow</CardTitle>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/80">Category Analysis</p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="relative flex-1 flex flex-col pt-4">
                <div className="relative h-[180px] mb-8 w-full">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <PieChart>
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent
                                    hideLabel
                                    formatter={(value, name) => (
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-muted-foreground mr-6 uppercase text-[10px] font-bold tracking-wider">{name}</span>
                                            <span className="text-foreground font-black">
                                                {formatCurrency(Number(value))}
                                            </span>
                                        </div>
                                    )}
                                />}
                            />
                            <Pie
                                data={spendingByCategory}
                                dataKey="amount"
                                nameKey="category"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                innerRadius={55}
                                strokeWidth={0}
                                paddingAngle={4}
                            >
                                {spendingByCategory.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color || COLORS[index % COLORS.length]}
                                        className="transition-all duration-300 hover:opacity-80 outline-none"
                                    />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">TOTAL</p>
                        <p className="text-xl font-black text-foreground tabular-nums tracking-tighter">{formatCurrency(totalSpending)}</p>
                    </div>
                </div>

                <div className="space-y-3 flex-1">
                    {spendingByCategory.slice(0, 4).map((category, index) => {
                        const color = category.color || COLORS[index % COLORS.length]
                        return (
                            <div
                                key={category.category}
                                className="group/item flex items-center gap-4 p-3 rounded-2xl hover:bg-muted/50 transition-all duration-300 cursor-default"
                            >
                                <div
                                    className="w-3 h-3 rounded-full shrink-0 shadow-lg relative"
                                    style={{
                                        backgroundColor: color,
                                        boxShadow: `0 0 12px ${color}30`
                                    }}
                                >
                                    <div className="absolute inset-0 rounded-full bg-inherit animate-ping opacity-20 group-hover/item:opacity-40 transition-opacity" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black truncate text-foreground/80 group-hover/item:text-foreground transition-colors uppercase tracking-tight">
                                        {category.category}
                                    </p>
                                    <div className="w-full h-1 bg-muted rounded-full mt-2 overflow-hidden">
                                        <div
                                            className="h-full bg-inherit rounded-full transition-all duration-1000"
                                            style={{
                                                backgroundColor: color,
                                                width: `${category.percentage}%`
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="text-right shrink-0">
                                    <p className="text-sm font-black tabular-nums text-foreground">{formatCurrency(category.amount)}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{category.percentage.toFixed(0)}%</p>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {spendingByCategory.length > 4 && (
                    <div className="mt-auto pt-4 flex justify-center">
                        <div className="px-4 py-1.5 rounded-full bg-secondary text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                            + {spendingByCategory.length - 4} ADDITIONAL UNITS
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
