import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import type { FinancialHealth } from '@/hooks/useFinancialHealth'
import {
    Activity,
    ShieldCheck,
    PieChartIcon,
    TrendingUp,
    Lightbulb,
    ChevronRight,
    Zap,
    Target,
    Wallet,
    ArrowUpRight,
    ArrowDownRight,
    Info
} from 'lucide-react'
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { usePreferences } from '@/hooks/usePreferences'

interface FinancialHealthScoreProps {
    data: FinancialHealth | null
    loading: boolean
}

export function FinancialHealthScore({ data, loading }: FinancialHealthScoreProps) {
    const [open, setOpen] = useState(false)
    const [hoveredMetric, setHoveredMetric] = useState<string | null>(null)
    const { formatCurrency } = usePreferences()

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

    const { score, savingsRate, budgetAdherence, emergencyFundProgress, nextSteps, metrics } = data

    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-emerald-500'
        if (s >= 60) return 'text-blue-500'
        if (s >= 40) return 'text-amber-500'
        return 'text-rose-500'
    }

    const getGaugeFillColor = (s: number) => {
        if (s >= 80) return 'hsl(142.1, 76.2%, 36.3%)'
        if (s >= 60) return 'hsl(217.2, 91.2%, 59.8%)'
        if (s >= 40) return 'hsl(37.7, 92.1%, 50.2%)'
        return 'hsl(346.8, 77.2%, 49.8%)'
    }

    const getGaugeGradient = (s: number) => {
        if (s >= 80) return { start: 'hsl(142.1, 76.2%, 45%)', end: 'hsl(142.1, 76.2%, 30%)' }
        if (s >= 60) return { start: 'hsl(217.2, 91.2%, 65%)', end: 'hsl(217.2, 91.2%, 50%)' }
        if (s >= 40) return { start: 'hsl(37.7, 92.1%, 55%)', end: 'hsl(37.7, 92.1%, 45%)' }
        return { start: 'hsl(346.8, 77.2%, 55%)', end: 'hsl(346.8, 77.2%, 45%)' }
    }

    const getScoreStatus = (s: number) => {
        if (s >= 80) return 'Excellent'
        if (s >= 60) return 'Good'
        if (s >= 40) return 'Average'
        return 'Needs Attention'
    }

    const getScoreBadgeStyle = (s: number) => {
        if (s >= 80) return 'bg-emerald-500/10 border-emerald-500/30'
        if (s >= 60) return 'bg-blue-500/10 border-blue-500/30'
        if (s >= 40) return 'bg-amber-500/10 border-amber-500/30'
        return 'bg-rose-500/10 border-rose-500/30'
    }

    const getScoreEmoji = (s: number) => {
        if (s >= 80) return <Zap className="h-4 w-4" />
        if (s >= 60) return <Target className="h-4 w-4" />
        if (s >= 40) return <Wallet className="h-4 w-4" />
        return <Activity className="h-4 w-4" />
    }

    const gradientColors = getGaugeGradient(score)
    const circumference = 2 * Math.PI * 50
    const strokeDashoffset = circumference - (score / 100) * circumference

    // Metrics data for enhanced display
    const metricsData = [
        {
            id: 'savings',
            icon: TrendingUp,
            label: 'Savings Rate',
            value: Math.round(savingsRate * 100),
            weight: 40,
            description: 'Percentage of income saved',
            detail: metrics ? `${formatCurrency(metrics.monthlyIncome - metrics.monthlyExpenses)} saved this month` : ''
        },
        {
            id: 'budget',
            icon: PieChartIcon,
            label: 'Budget Adherence',
            value: Math.round(budgetAdherence * 100),
            weight: 30,
            description: 'Categories within budget',
            detail: metrics ? `${formatCurrency(metrics.totalSpent)} of ${formatCurrency(metrics.totalBudgeted)} budgeted` : ''
        },
        {
            id: 'emergency',
            icon: ShieldCheck,
            label: 'Emergency Fund',
            value: Math.round(emergencyFundProgress * 100),
            weight: 30,
            description: '6 months expenses target',
            detail: metrics ? `${formatCurrency(metrics.currentEmergencyFund)} of ${formatCurrency(metrics.targetEmergencyFund)} goal` : ''
        }
    ]

    return (
        <TooltipProvider>
            <>
                <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden group flex flex-col relative">
                    {/* Animated gradient background */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-30"
                        style={{
                            background: `
                                radial-gradient(circle at 20% 20%, ${gradientColors.start}20 0%, transparent 50%),
                                radial-gradient(circle at 80% 80%, ${gradientColors.end}15 0%, transparent 50%)
                            `
                        }}
                    />


                    <CardHeader className="pb-2 relative z-10">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <div className={cn(
                                    "p-1 rounded-md",
                                    score >= 60 ? "bg-primary/10" : "bg-destructive/10"
                                )}>
                                    <Activity className={cn("h-4 w-4", getScoreColor(score))} />
                                </div>
                                Health Score
                            </CardTitle>
                            <div className={cn(
                                "flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-full border",
                                getScoreColor(score),
                                getScoreBadgeStyle(score)
                            )}>
                                {getScoreEmoji(score)}
                                {getScoreStatus(score)}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                            {/* Score Ring Section */}
                            <div className="flex items-center justify-center">
                                <div
                                    className="relative h-[180px] w-full flex items-center justify-center cursor-pointer group/ring"
                                    onClick={() => setOpen(true)}
                                >
                                    {/* Glow effect */}
                                    <div
                                        className="absolute inset-0 blur-xl opacity-20 rounded-full"
                                        style={{ backgroundColor: getGaugeFillColor(score) }}
                                    />

                                    <svg viewBox="0 0 120 120" className="w-[160px] h-[160px] transform -rotate-90">
                                        <defs>
                                            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor={gradientColors.start} />
                                                <stop offset="100%" stopColor={gradientColors.end} />
                                            </linearGradient>
                                        </defs>

                                        {/* Background track with subtle pattern */}
                                        <circle
                                            cx="60"
                                            cy="60"
                                            r="50"
                                            fill="none"
                                            stroke="hsl(var(--muted))"
                                            strokeWidth="8"
                                            opacity="0.15"
                                        />

                                        {/* Tick marks */}
                                        {[...Array(12)].map((_, i) => (
                                            <line
                                                key={i}
                                                x1="60"
                                                y1="6"
                                                x2="60"
                                                y2="10"
                                                stroke="hsl(var(--muted-foreground))"
                                                strokeWidth="1"
                                                opacity="0.3"
                                                transform={`rotate(${i * 30} 60 60)`}
                                            />
                                        ))}

                                        {/* Animated score arc with gradient */}
                                        <circle
                                            cx="60"
                                            cy="60"
                                            r="50"
                                            fill="none"
                                            stroke="url(#scoreGradient)"
                                            strokeWidth="10"
                                            strokeLinecap="round"
                                            strokeDasharray={circumference}
                                            strokeDashoffset={strokeDashoffset}
                                        />

                                        {/* End cap glow */}
                                        <circle
                                            cx="60"
                                            cy="10"
                                            r="6"
                                            fill={getGaugeFillColor(score)}
                                            opacity={score > 5 ? 0.6 : 0}
                                            style={{
                                                transform: `rotate(${(score / 100) * 360}deg)`,
                                                transformOrigin: '60px 60px'
                                            }}
                                        />
                                    </svg>

                                    {/* Center content */}
                                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                                        <span
                                            className="text-4xl font-black tracking-tight"
                                            style={{ color: getGaugeFillColor(score) }}
                                        >
                                            {score}
                                        </span>
                                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                                            out of 100
                                        </span>

                                        {/* Trend indicator */}
                                        <div className={cn(
                                            "flex items-center gap-0.5 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                            score >= 60 ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"
                                        )}>
                                            {score >= 60 ? (
                                                <ArrowUpRight className="h-3 w-3" />
                                            ) : (
                                                <ArrowDownRight className="h-3 w-3" />
                                            )}
                                            <span>{score >= 60 ? 'On track' : 'Improve'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Metrics Section */}
                            <div className="flex flex-col justify-center space-y-3 py-2">
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center justify-between">
                                    <span>Score Breakdown</span>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-3.5 w-3.5 cursor-help opacity-50 hover:opacity-100 transition-opacity" />
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="max-w-[200px]">
                                            <p className="text-xs">Your health score is calculated from savings (40%), budget adherence (30%), and emergency fund progress (30%).</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>

                                {metricsData.map((metric) => (
                                    <EnhancedMetricBar
                                        key={metric.id}
                                        icon={metric.icon}
                                        label={metric.label}
                                        value={metric.value}
                                        weight={metric.weight}
                                        description={metric.description}
                                        detail={metric.detail}
                                        isHovered={hoveredMetric === metric.id}
                                        onHover={(hovered) => setHoveredMetric(hovered ? metric.id : null)}
                                    />
                                ))}
                            </div>
                        </div>
                    </CardContent>

                    {nextSteps.length > 0 && (
                        <CardFooter className="pt-0 pb-4 relative z-10">
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
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <div className={cn(
                                    "p-1.5 rounded-lg",
                                    score >= 60 ? "bg-emerald-500/10" : "bg-amber-500/10"
                                )}>
                                    <Activity className={cn("h-5 w-5", getScoreColor(score))} />
                                </div>
                                Financial Health Breakdown
                            </DialogTitle>
                            <DialogDescription>
                                Your score is calculated based on three key financial pillars.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 pt-4">
                            {/* Large score display */}
                            <div className="flex items-center justify-center py-8 bg-gradient-to-br from-muted/30 to-muted/10 rounded-2xl border border-border/50 relative overflow-hidden">
                                <div
                                    className="absolute inset-0 opacity-20"
                                    style={{
                                        background: `radial-gradient(circle at center, ${getGaugeFillColor(score)} 0%, transparent 70%)`
                                    }}
                                />
                                <div className="text-center relative z-10">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <span className={cn(
                                            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                                            getScoreBadgeStyle(score),
                                            getScoreColor(score)
                                        )}>
                                            {getScoreEmoji(score)}
                                            {getScoreStatus(score)}
                                        </span>
                                    </div>
                                    <span className={cn("text-7xl font-black tracking-tighter", getScoreColor(score))}>
                                        {score}
                                    </span>
                                    <p className="text-sm font-medium text-muted-foreground mt-2 uppercase tracking-widest">
                                        Current Score
                                    </p>
                                </div>
                            </div>

                            {/* Score components breakdown */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                                    Score Components
                                </h4>
                                <div className="space-y-3">
                                    {metricsData.map((metric) => (
                                        <div
                                            key={metric.id}
                                            className="p-3 rounded-xl bg-card border border-border/50"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <metric.icon className={cn("h-4 w-4", getMetricColor(metric.value).icon)} />
                                                    <span className="text-sm font-medium">{metric.label}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">
                                                        {metric.weight}% weight
                                                    </span>
                                                    <span className={cn("text-sm font-bold", getMetricColor(metric.value).text)}>
                                                        {metric.value}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full transition-all", getMetricColor(metric.value).bar)}
                                                    style={{ width: `${metric.value}%` }}
                                                />
                                            </div>
                                            {metric.detail && (
                                                <p className="text-xs text-muted-foreground mt-2">{metric.detail}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action plan */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Action Plan</h4>
                                {nextSteps.map((step, i) => (
                                    <div key={i} className="flex gap-3 p-3 rounded-xl bg-card border border-border/50 items-start group hover:bg-muted/20 transition-colors">
                                        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
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
        </TooltipProvider>
    )
}

interface EnhancedMetricBarProps {
    icon: React.ElementType
    label: string
    value: number
    weight: number
    description: string
    detail: string
    isHovered: boolean
    onHover: (hovered: boolean) => void
}

function getMetricColor(value: number) {
    if (value >= 80) return { bar: 'bg-emerald-500', icon: 'text-emerald-500', text: 'text-emerald-500', glow: 'shadow-emerald-500/20' }
    if (value >= 50) return { bar: 'bg-blue-500', icon: 'text-blue-500', text: 'text-blue-500', glow: 'shadow-blue-500/20' }
    if (value >= 25) return { bar: 'bg-amber-500', icon: 'text-amber-500', text: 'text-amber-500', glow: 'shadow-amber-500/20' }
    return { bar: 'bg-rose-500', icon: 'text-rose-500', text: 'text-rose-500', glow: 'shadow-rose-500/20' }
}

function EnhancedMetricBar({ icon: Icon, label, value, weight, description, detail, isHovered, onHover }: EnhancedMetricBarProps) {
    const colors = getMetricColor(value)

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={cn(
                            "space-y-1.5 p-2 rounded-lg transition-all cursor-pointer",
                            "hover:bg-muted/30",
                            isHovered && "bg-muted/40 ring-1 ring-border"
                        )}
                        onMouseEnter={() => onHover(true)}
                        onMouseLeave={() => onHover(false)}
                    >
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                            <div className="flex items-center gap-2">
                                <div className={cn(
                                    "p-1 rounded transition-colors",
                                    isHovered ? "bg-muted" : "bg-transparent"
                                )}>
                                    <Icon className={cn("h-3.5 w-3.5 transition-colors", colors.icon)} />
                                </div>
                                <span className="truncate">{label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-muted-foreground/70 font-medium">
                                    {weight}%
                                </span>
                                <span className={cn(
                                    "font-black transition-all tabular-nums",
                                    colors.text,
                                    isHovered && "scale-110"
                                )}>
                                    {Math.min(100, value)}%
                                </span>
                            </div>
                        </div>
                        <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border/30">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all duration-700 ease-out",
                                    colors.bar,
                                    isHovered && "shadow-lg " + colors.glow
                                )}
                                style={{
                                    width: `${Math.min(100, Math.max(value > 0 ? 3 : 0, value))}%`,
                                }}
                            />
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[200px]">
                    <p className="font-medium text-xs mb-1">{description}</p>
                    {detail && <p className="text-[10px] text-muted-foreground">{detail}</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
