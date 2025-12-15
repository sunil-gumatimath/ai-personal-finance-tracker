import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
    title: string
    value: string
    change?: string
    changeType?: 'positive' | 'negative' | 'neutral'
    percentageChange?: string
    trendDescription?: string
    subtitle?: string
    icon?: LucideIcon
    iconColor?: string
}

export function StatCard({
    title,
    value,
    change,
    changeType = 'neutral',
    percentageChange,
    trendDescription,
    subtitle,
}: StatCardProps) {
    const TrendIcon = changeType === 'positive'
        ? TrendingUp
        : changeType === 'negative'
            ? TrendingDown
            : Minus

    const displayPercentage = percentageChange || (change && change.includes('%') ? change.split('%')[0] + '%' : null)
    const displayTrendDesc = trendDescription || (change && !change.includes('%') ? change : null)

    return (
        <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

            {/* Header with title and percentage badge */}
            <div className="relative flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">
                    {title}
                </span>
                {displayPercentage && (
                    <div className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        changeType === 'positive' && "text-emerald-400",
                        changeType === 'negative' && "text-rose-400",
                        changeType === 'neutral' && "text-muted-foreground"
                    )}>
                        <TrendIcon className="h-3 w-3" />
                        <span>{displayPercentage}</span>
                    </div>
                )}
            </div>

            {/* Main Value */}
            <div className="relative mb-3">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {value}
                </span>
            </div>

            {/* Trend Description */}
            {displayTrendDesc && (
                <div className={cn(
                    "flex items-center gap-1.5 text-sm font-medium mb-1",
                    changeType === 'positive' && "text-emerald-400",
                    changeType === 'negative' && "text-rose-400",
                    changeType === 'neutral' && "text-muted-foreground"
                )}>
                    <span>{displayTrendDesc}</span>
                    <TrendIcon className="h-3.5 w-3.5" />
                </div>
            )}

            {/* Subtitle */}
            {subtitle && (
                <p className="text-xs text-muted-foreground/70">
                    {subtitle}
                </p>
            )}

            {/* Decorative corner accent */}
            <div className={cn(
                "absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20",
                changeType === 'positive' && "bg-emerald-500",
                changeType === 'negative' && "bg-rose-500",
                changeType === 'neutral' && "bg-primary"
            )} />
        </div>
    )
}
