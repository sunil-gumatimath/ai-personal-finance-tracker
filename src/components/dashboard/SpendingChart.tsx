import { useMemo } from 'react'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { MonthlyTrend } from '@/types'

interface SpendingChartProps {
    data: MonthlyTrend[]
}

const chartConfig = {
    income: {
        label: 'Income',
        color: 'hsl(142.1 70.6% 45.3%)',
    },
    expenses: {
        label: 'Expenses',
        color: 'hsl(0 72.2% 50.6%)',
    },
}

export function SpendingChart({ data }: SpendingChartProps) {
    const chartData = useMemo(() => {
        if (data.length === 0) {
            // Generate placeholder data for the last 6 months
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            return months.map((month) => ({
                month,
                income: 0,
                expenses: 0,
            }))
        }
        return data
    }, [data])

    return (
        <Card>
            <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
                <CardDescription>Monthly comparison for the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                className="text-xs"
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `$${value}`}
                                className="text-xs"
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar
                                dataKey="income"
                                fill="var(--color-income)"
                                radius={[4, 4, 0, 0]}
                                className="fill-green-500"
                            />
                            <Bar
                                dataKey="expenses"
                                fill="var(--color-expenses)"
                                radius={[4, 4, 0, 0]}
                                className="fill-red-500"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
