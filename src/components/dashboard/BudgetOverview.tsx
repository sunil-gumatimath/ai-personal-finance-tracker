import { Pie, PieChart, Label } from 'recharts'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/hooks/usePreferences'
import type { SpendingByCategory } from '@/types'
import { PieChartIcon, TrendingDown } from 'lucide-react'
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
    'hsl(220 13% 13%)',       // Dark charcoal
    'hsl(220 10% 35%)',       // Medium gray
    'hsl(220 8% 50%)',        // Light gray
    'hsl(346.8 77.2% 49.8%)', // Rose
    'hsl(142.1 76.2% 36.3%)', // Green
    'hsl(221.2 83.2% 53.3%)', // Blue
    'hsl(262.1 83.3% 57.8%)', // Purple
    'hsl(24.6 95% 53.1%)',    // Orange
    'hsl(47.9 95.8% 53.1%)',  // Yellow
    'hsl(173.4 80.4% 40%)',   // Teal
    'hsl(280 65.3% 60%)',     // Violet
    'hsl(340 75.5% 55%)',     // Pink
]

export function BudgetOverview({ spendingByCategory }: BudgetOverviewProps) {
    const { formatCurrency } = usePreferences()

    const totalSpending = spendingByCategory.reduce((sum, cat) => sum + cat.amount, 0)
    const topCategory = spendingByCategory[0]
    const topPercentage = topCategory ? Math.round(topCategory.percentage) : 0

    // Show all categories in the pie chart
    const chartData = spendingByCategory.map((cat, index) => ({
        category: cat.category,
        amount: cat.amount,
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

    if (spendingByCategory.length === 0) {
        return (
            <Card className="h-full flex flex-col">
                <CardHeader className="items-center pb-0">
                    <CardTitle>Spending Flow</CardTitle>
                    <CardDescription>Category breakdown</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                    <PieChartIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
                    <p className="text-sm font-medium">No spending data</p>
                    <p className="text-xs text-muted-foreground">
                        Add transactions to see your spending breakdown.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="items-center pb-0">
                <CardTitle>Spending Flow</CardTitle>
                <CardDescription>This month's expenses</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                            data={chartData}
                            dataKey="amount"
                            nameKey="category"
                            innerRadius={60}
                            strokeWidth={5}
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
                                                    y={viewBox.cy}
                                                    className="fill-foreground text-3xl font-bold"
                                                >
                                                    {topPercentage}%
                                                </tspan>
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={(viewBox.cy || 0) + 24}
                                                    className="fill-muted-foreground"
                                                >
                                                    {topCategory?.category || 'Spent'}
                                                </tspan>
                                            </text>
                                        )
                                    }
                                }}
                            />
                        </Pie>
                    </PieChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 font-medium leading-none">
                    <TrendingDown className="h-4 w-4" />
                    Total spent: {formatCurrency(totalSpending)}
                </div>
                <div className="leading-none text-muted-foreground">
                    Showing all {chartData.length} categories
                </div>
            </CardFooter>
        </Card>
    )
}
