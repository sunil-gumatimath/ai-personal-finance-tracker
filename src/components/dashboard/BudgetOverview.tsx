import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { SpendingByCategory } from '@/types'

interface BudgetOverviewProps {
    spendingByCategory: SpendingByCategory[]
}

const COLORS = [
    'hsl(142.1 70.6% 45.3%)',
    'hsl(217.2 91.2% 59.8%)',
    'hsl(263.4 70% 50.4%)',
    'hsl(43 74% 66%)',
    'hsl(0 72.2% 50.6%)',
    'hsl(173 58% 39%)',
]

export function BudgetOverview({ spendingByCategory }: BudgetOverviewProps) {
    if (spendingByCategory.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Spending by Category</CardTitle>
                    <CardDescription>Where your money is going</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            No spending data available yet
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
                <CardDescription>Where your money is going</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-6 lg:flex-row">
                    <div className="h-[200px] flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={spendingByCategory}
                                    dataKey="amount"
                                    nameKey="category"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    innerRadius={50}
                                    strokeWidth={2}
                                >
                                    {spendingByCategory.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color || COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) =>
                                        new Intl.NumberFormat('en-US', {
                                            style: 'currency',
                                            currency: 'USD',
                                        }).format(value)
                                    }
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-4">
                        {spendingByCategory.slice(0, 4).map((category, index) => (
                            <div key={category.category} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium">{category.category}</span>
                                    <span className="text-muted-foreground">
                                        {category.percentage.toFixed(0)}%
                                    </span>
                                </div>
                                <Progress
                                    value={category.percentage}
                                    className="h-2"
                                    style={
                                        {
                                            '--progress-color': category.color || COLORS[index % COLORS.length],
                                        } as React.CSSProperties
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
