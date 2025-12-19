import { useState, useEffect } from 'react'
import { Sparkles, AlertCircle, ChevronRight, Brain, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAIInsights } from '@/hooks/useAIInsights'
import type { Insight } from '@/hooks/useAIInsights'
import { cn } from '@/lib/utils'

export function AICoach() {
    const { insights, loading } = useAIInsights()
    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        if (insights.length > 1) {
            const timer = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % insights.length)
            }, 8000)
            return () => clearInterval(timer)
        }
    }, [insights.length])

    // Loading skeleton
    if (loading) {
        return (
            <Card className="border-border/50 bg-card/50">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-64" />
                        </div>
                        <Skeleton className="h-8 w-20 rounded-md" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (insights.length === 0) return null

    const currentInsight = insights[currentIndex]

    const getIcon = (type: Insight['type']) => {
        switch (type) {
            case 'anomaly': return <AlertCircle className="h-4 w-4 text-rose-500" />
            case 'kudo': return <Trophy className="h-4 w-4 text-emerald-500" />
            case 'coaching': return <Brain className="h-4 w-4 text-blue-500" />
            default: return <Sparkles className="h-4 w-4 text-amber-500" />
        }
    }

    const getTypeStyles = (type: Insight['type']) => {
        switch (type) {
            case 'anomaly': return 'bg-rose-500/10 text-rose-600 border-rose-500/20'
            case 'kudo': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
            case 'coaching': return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
            default: return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
        }
    }

    const getTypeLabel = (type: Insight['type']) => {
        switch (type) {
            case 'anomaly': return 'Alert'
            case 'kudo': return 'Achievement'
            case 'coaching': return 'Tip'
            default: return 'Insight'
        }
    }

    return (
        <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Icon */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            {getIcon(currentInsight.type)}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-xs px-2 py-0", getTypeStyles(currentInsight.type))}>
                                {getTypeLabel(currentInsight.type)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">AI Agent</span>
                        </div>
                        <h3 className="text-sm font-medium text-foreground truncate">
                            {currentInsight.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                            {currentInsight.description}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                        {insights.length > 1 && (
                            <div className="hidden sm:flex items-center gap-1">
                                {insights.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentIndex(i)}
                                        className={cn(
                                            "h-1.5 w-1.5 rounded-full transition-colors",
                                            currentIndex === i ? "bg-primary" : "bg-muted-foreground/30"
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                        <Button
                            size="sm"
                            className="h-8"
                            onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat'))}
                        >
                            Chat
                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
