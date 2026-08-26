import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
    title: string
    value: string
    changeType?: 'positive' | 'negative' | 'neutral'
    /**
     * Tints the main value with income/expense semantic colors — used when the
     * figure itself is money-positive/negative (e.g. a negative monthly net),
     * independent of any trend direction.
     */
    valueSemantic?: 'positive' | 'negative'
    percentageChange?: string
    trendDescription?: string
    subtitle?: string
}

// Money semantics follow the shared --income/--expense tokens (see Reports.tsx).
const SEMANTIC_TEXT = {
    positive: 'text-[var(--income)]',
    negative: 'text-[var(--expense)]',
} as const

const SEMANTIC_BADGE = {
    positive: 'bg-[var(--income)]/10 text-[var(--income)] border-[var(--income)]/20',
    negative: 'bg-[var(--expense)]/10 text-[var(--expense)] border-[var(--expense)]/20',
} as const

export function StatCard({
    title,
    value,
    changeType = 'neutral',
    valueSemantic,
    percentageChange,
    trendDescription,
    subtitle,
}: StatCardProps) {
    const TrendIcon = changeType === 'positive'
        ? TrendingUp
        : changeType === 'negative'
            ? TrendingDown
            : Minus

    return (
        <Card className="relative gap-0 overflow-hidden rounded-2xl border-border bg-card py-0">
            <CardContent className="p-5">
                {/* Header with title and percentage badge */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-muted-foreground">
                        {title}
                    </span>
                    {percentageChange && (
                        <div className={cn(
                            "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                            changeType === 'positive' && SEMANTIC_BADGE.positive,
                            changeType === 'negative' && SEMANTIC_BADGE.negative,
                            changeType === 'neutral' && "bg-muted/50 text-muted-foreground border-border/30"
                        )}>
                            <TrendIcon className="h-3 w-3" />
                            <span>{percentageChange}</span>
                        </div>
                    )}
                </div>

                {/* Main Value */}
                <div className="mb-3">
                    <span className={cn(
                        "text-2xl sm:text-3xl font-bold tracking-tight text-foreground",
                        valueSemantic && SEMANTIC_TEXT[valueSemantic]
                    )}>
                        {value}
                    </span>
                </div>

                {/* Trend Description */}
                {trendDescription && (
                    <div className={cn(
                        "flex items-center gap-1.5 text-sm font-semibold mb-1",
                        changeType === 'positive' && SEMANTIC_TEXT.positive,
                        changeType === 'negative' && SEMANTIC_TEXT.negative,
                        changeType === 'neutral' && "text-muted-foreground"
                    )}>
                        <span>{trendDescription}</span>
                        <TrendIcon className="h-3.5 w-3.5" />
                    </div>
                )}

                {/* Subtitle */}
                {subtitle && (
                    <p className="text-xs text-muted-foreground/70">
                        {subtitle}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
