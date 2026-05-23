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
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
            {/* Header with title and percentage badge */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">
                    {title}
                </span>
                {displayPercentage && (
                    <div className={cn(
                        "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                        changeType === 'positive' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        changeType === 'negative' && "bg-rose-500/10 text-rose-400 border-rose-500/20",
                        changeType === 'neutral' && "bg-muted/50 text-muted-foreground border-border/30"
                    )}>
                        <TrendIcon className="h-3 w-3" />
                        <span>{displayPercentage}</span>
                    </div>
                )}
            </div>

            {/* Main Value */}
            <div className="mb-3">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {value}
                </span>
            </div>

            {/* Trend Description */}
            {displayTrendDesc && (
                <div className={cn(
                    "flex items-center gap-1.5 text-sm font-semibold mb-1",
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
                <p className="text-xs text-muted-foreground/60">
                    {subtitle}
                </p>
            )}
        </div>
    )
}
