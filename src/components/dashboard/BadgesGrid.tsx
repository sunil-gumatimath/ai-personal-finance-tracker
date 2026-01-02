import type { Badge as BadgeType } from '@/hooks/useFinancialHealth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Crown, Target, Sword, Star, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BadgesGridProps {
    badges: BadgeType[]
}

const ICON_MAP: Record<string, React.ElementType> = {
    Crown,
    Target,
    Sword,
    Star
}

export function BadgesGrid({ badges }: BadgesGridProps) {
    return (
        <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Achievements</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 h-full">
                    {badges.map((badge) => {
                        const Icon = ICON_MAP[badge.icon] || Star
                        return (
                            <div
                                key={badge.id}
                                className={cn(
                                    "group relative flex flex-col items-center justify-between p-4 rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                                    badge.unlocked
                                        ? "bg-gradient-to-br from-primary/5 to-transparent border-primary/20 hover:border-primary/40 hover:bg-primary/10"
                                        : "bg-muted/30 border-dashed border-border opacity-90"
                                )}
                            >
                                {/* Active State Background Effects */}
                                {badge.unlocked && (
                                    <div className="absolute inset-0 bg-primary/5 blur-xl rounded-full scale-0 group-hover:scale-75 transition-transform duration-500 pointer-events-none" />
                                )}

                                <div className="flex flex-col items-center w-full">
                                    <div className={cn(
                                        "relative h-14 w-14 rounded-full flex items-center justify-center mb-3 shadow-sm transition-transform duration-500 group-hover:scale-110",
                                        badge.unlocked
                                            ? "bg-background border-2 border-primary/20 text-primary shadow-primary/20"
                                            : "bg-muted border border-border text-muted-foreground"
                                    )}>
                                        {badge.unlocked ? <Icon className="h-7 w-7" /> : <Lock className="h-6 w-6 opacity-40" />}
                                    </div>

                                    <h4 className={cn(
                                        "text-xs font-black text-center mb-1.5 transition-colors",
                                        badge.unlocked ? "text-foreground" : "text-muted-foreground"
                                    )}>
                                        {badge.name}
                                    </h4>

                                    <p className="text-[10px] text-muted-foreground text-center leading-tight line-clamp-2 mb-3">
                                        {badge.description}
                                    </p>

                                    {/* Progress Bar for Locked Badges */}
                                    {!badge.unlocked && (
                                        <div className="w-full mt-auto space-y-1">
                                            <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                                <span>Progress</span>
                                                <span>{Math.round(badge.progress || 0)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden border border-border/50">
                                                <div
                                                    className="h-full bg-primary/50 rounded-full transition-all duration-1000"
                                                    style={{ width: `${Math.min(100, Math.max(5, badge.progress || 0))}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {badge.unlocked && (
                                    <div className="absolute top-3 right-3">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
