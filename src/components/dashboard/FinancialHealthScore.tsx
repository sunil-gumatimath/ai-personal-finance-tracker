import { Pie, PieChart, Label, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import type { FinancialHealth } from '@/hooks/useFinancialHealth'
import { Activity, ShieldCheck, PieChartIcon, TrendingUp, Lightbulb, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'

interface FinancialHealthScoreProps {
    data: FinancialHealth | null
    loading: boolean
}

export function FinancialHealthScore({ data, loading }: FinancialHealthScoreProps) {
    const [open, setOpen] = useState(false)

    if (loading || !data) {
        return (
            <Card className="h-full border-border/50 bg-card/50">
                <CardHeader>
                    <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    <Skeleton className="h-32 w-32 rounded-full" />
                    <div className="w-full space-y-2">
                        <Skeleton className="h-2 w-full" />
                        <Skeleton className="h-2 w-full" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    const { score, savingsRate, budgetAdherence, emergencyFundProgress, nextSteps } = data

    const chartData = [
        { name: 'Score', value: score },
        { name: 'Remaining', value: 100 - score },
    ]

    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-emerald-500'
        if (s >= 60) return 'text-primary'
        if (s >= 40) return 'text-amber-500'
        return 'text-rose-500'
    }

    const getScoreStatus = (s: number) => {
        if (s >= 80) return 'Excellent'
        if (s >= 60) return 'Good'
        if (s >= 40) return 'Average'
        return 'Needs Attention'
    }

    return (
        <>
            <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden group flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Health Score
                        </CardTitle>
                        <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full border border-border/50", getScoreColor(score))}>
                            {getScoreStatus(score)}
                        </span>
                    </div>
                </CardHeader>

                <CardContent className="flex-1">
                    <div className="flex flex-col items-center">
                        <div
                            className="relative h-[200px] w-full cursor-pointer hover:scale-105 transition-transform duration-300"
                            onClick={() => setOpen(true)}
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        startAngle={225}
                                        endAngle={-45}
                                        dataKey="value"
                                        cornerRadius={10}
                                        strokeWidth={0}
                                    >
                                        <Cell key="score" fill="hsl(var(--primary))" />
                                        <Cell key="remaining" fill="hsl(var(--muted)/0.2)" />

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
                                                                y={(viewBox.cy || 0) + 2}
                                                                className={cn("text-5xl font-black fill-foreground tracking-tighter", getScoreColor(score))}
                                                            >
                                                                {score}
                                                            </tspan>
                                                            <tspan
                                                                x={viewBox.cx}
                                                                y={(viewBox.cy || 0) + 28}
                                                                className="fill-muted-foreground text-[10px] font-bold uppercase tracking-widest"
                                                            >
                                                                / 100
                                                            </tspan>
                                                        </text>
                                                    )
                                                }
                                            }}
                                        />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-x-0 bottom-0 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-background/80 px-2 py-1 rounded-full border border-primary/20">Click for details</span>
                            </div>
                        </div>

                        <div className="w-full space-y-5 px-2 pb-2">
                            <MetricBar
                                icon={TrendingUp}
                                label="Savings Rate"
                                value={Math.round(savingsRate * 100)}
                                color="bg-emerald-500"
                            />
                            <MetricBar
                                icon={PieChartIcon}
                                label="Budget Adherence"
                                value={Math.round(budgetAdherence * 100)}
                                color="bg-primary"
                            />
                            <MetricBar
                                icon={ShieldCheck}
                                label="Emergency Fund"
                                value={Math.round(emergencyFundProgress * 100)}
                                color="bg-blue-500"
                            />
                        </div>
                    </div>
                </CardContent>

                {nextSteps.length > 0 && (
                    <CardFooter className="pt-0 pb-4">
                        <Button
                            variant="ghost"
                            className="w-full justify-between h-auto py-3 px-4 bg-muted/20 hover:bg-muted/40 border border-transparent hover:border-border/50 rounded-xl group/btn"
                            onClick={() => setOpen(true)}
                        >
                            <div className="flex items-start gap-3 text-left">
                                <div className="p-1.5 rounded-full bg-primary/10 text-primary mt-0.5">
                                    <Lightbulb className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold line-clamp-1">Improve your score</p>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1 opacity-80">
                                        {nextSteps[0]}
                                    </p>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover/btn:translate-x-1 transition-transform" />
                        </Button>
                    </CardFooter>
                )}
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary" />
                            Financial Health Breakdown
                        </DialogTitle>
                        <DialogDescription>
                            Your score is calculated based on three key financial pillars.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 pt-4">
                        <div className="flex items-center justify-center py-6 bg-muted/20 rounded-2xl border border-dashed border-border/50">
                            <div className="text-center">
                                <span className={cn("text-6xl font-black tracking-tighter", getScoreColor(score))}>
                                    {score}
                                </span>
                                <p className="text-sm font-medium text-muted-foreground mt-2 uppercase tracking-widest">Current Score</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Action Plan</h4>
                            {nextSteps.map((step, i) => (
                                <div key={i} className="flex gap-3 p-3 rounded-xl bg-card border border-border/50 items-start">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
                                        {i + 1}
                                    </div>
                                    <p className="text-sm font-medium leading-relaxed">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

interface MetricBarProps {
    icon: React.ElementType
    label: string
    value: number
    color: string
}

function MetricBar({ icon: Icon, label, value, color }: MetricBarProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                </div>
                <span className="text-foreground font-black">{Math.min(100, value)}%</span>
            </div>
            <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]", color)}
                    style={{ width: `${Math.min(100, value)}%` }}
                />
            </div>
        </div>
    )
}
