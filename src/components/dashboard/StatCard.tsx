import { type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
    title: string
    value: string
    change?: string
    changeType?: 'positive' | 'negative' | 'neutral'
    icon: LucideIcon
    iconColor?: string
}

export function StatCard({
    title,
    value,
    change,
    changeType = 'neutral',
    icon: Icon,
    iconColor = 'text-primary',
}: StatCardProps) {
    return (
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
            <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-gradient-to-br from-primary/10 to-transparent" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <div className={cn('rounded-lg bg-primary/10 p-2', iconColor)}>
                    <Icon className="h-4 w-4" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {change && (
                    <p
                        className={cn(
                            'mt-1 text-xs',
                            changeType === 'positive' && 'text-green-500',
                            changeType === 'negative' && 'text-red-500',
                            changeType === 'neutral' && 'text-muted-foreground'
                        )}
                    >
                        {change}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
