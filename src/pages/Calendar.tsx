import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
} from 'date-fns'
import {
    ChevronLeft,
    ChevronRight,
    ArrowUpRight,
    ArrowDownLeft,
    ArrowLeftRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { ErrorState } from '@/components/system/ErrorState'
import { api } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { cn } from '@/lib/utils'
import { parseTransactionDate } from '@/lib/date-utils'
import { formatCompactCurrency, toNumber } from '@/lib/number'
import type { Transaction } from '@/types'

/** Mirrors Reports — the API caps results; beyond this we'd silently truncate. */
const CALENDAR_TX_LIMIT = 1000

export function Calendar() {
    const { user } = useAuth()
    const { formatCurrency, preferences } = usePreferences()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const fetchTransactions = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        setError(false)

        const start = startOfWeek(startOfMonth(currentDate))
        const end = endOfWeek(endOfMonth(currentDate))

        // Format dates as YYYY-MM-DD to avoid timezone issues with PostgreSQL DATE type
        const formatDateStr = (date: Date): string => {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
        }

        try {
            const res = await api.transactions.list({
                since: formatDateStr(start),
                limit: CALENDAR_TX_LIMIT,
            })
            const rows = (res.transactions || []) as Transaction[]
            const endStr = formatDateStr(end)
            const filtered = rows.filter(t => String(t.date).split('T')[0] <= endStr)
            setTransactions(filtered)
        } catch (err) {
            console.error('Error fetching transactions:', err)
            // A silent failure used to render an empty-looking month.
            toast.error('Failed to load calendar transactions')
            setError(true)
        } finally {
            setLoading(false)
        }
    }, [user, currentDate])

    useEffect(() => {
        fetchTransactions()
    }, [fetchTransactions])

    const { calendarGrid } = useMemo(() => {
        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(monthStart)
        const startDate = startOfWeek(monthStart)
        const endDate = endOfWeek(monthEnd)

        const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate })

        // Group transactions by date
        const grid = daysInMonth.map(day => {
            const dayTransactions = transactions.filter(t =>
                isSameDay(parseTransactionDate(t.date), day)
            )

            const income = dayTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + toNumber(t.amount), 0)

            const expense = dayTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + toNumber(t.amount), 0)

            return {
                date: day,
                transactions: dayTransactions,
                summary: { income, expense }
            }
        })

        return { days: daysInMonth, calendarGrid: grid }
    }, [currentDate, transactions])

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
    const resetToToday = () => setCurrentDate(new Date())

    const handleDayClick = (dayData: typeof calendarGrid[0]) => {
        if (dayData.transactions.length > 0) {
            setSelectedDate(dayData.date)
            setIsDialogOpen(true)
        }
    }

    const selectedDayData = selectedDate
        ? calendarGrid.find(d => isSameDay(d.date, selectedDate))
        : null

    if (loading) {
        return (
            <div className="space-y-6">
                {/* Header skeleton */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-9 w-48" />
                        <Skeleton className="h-5 w-72 max-w-full" />
                    </div>
                    <Skeleton className="h-10 w-64 max-w-full" />
                </div>
                {/* Weekday header + 7×6 grid skeleton */}
                <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                    <Skeleton className="h-10 w-full rounded-none" />
                    <div className="grid grid-cols-7">
                        {[...Array(42)].map((_, i) => (
                            <Skeleton
                                key={i}
                                className="h-[100px] w-full rounded-none border-b border-r border-border/30"
                            />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Calendar</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Visualize your income and expenses over time
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Previous month"
                        onClick={prevMonth}
                        className="h-11 w-11"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    {/* Announced when month navigation changes it */}
                    <div className="min-w-[140px] text-center font-medium" aria-live="polite">
                        {format(currentDate, 'MMMM yyyy')}
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Next month"
                        onClick={nextMonth}
                        className="h-11 w-11"
                    >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button variant="secondary" onClick={resetToToday} className="ml-2 active:scale-[0.98] transition-transform duration-150 ease-out">
                        Today
                    </Button>
                </div>
            </div>

            {error && (
                <ErrorState
                    title="Couldn't load this month"
                    message="Some transactions may be missing from the calendar. Check your connection and try again."
                    onRetry={fetchTransactions}
                />
            )}

            <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-border hover:bg-card/80">
                <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-semibold leading-6 text-muted-foreground lg:text-sm">
                    <div className="py-2">Sun</div>
                    <div className="py-2">Mon</div>
                    <div className="py-2">Tue</div>
                    <div className="py-2">Wed</div>
                    <div className="py-2">Thu</div>
                    <div className="py-2">Fri</div>
                    <div className="py-2">Sat</div>
                </div>
                <div className="grid grid-cols-7 text-sm">
                    {calendarGrid.map((day, idx) => {
                        const hasTransactions = day.transactions.length > 0
                        const isToday = isSameDay(day.date, new Date())
                        return (
                            <div
                                key={day.date.toString()}
                                {...(hasTransactions
                                    ? {
                                          role: 'button' as const,
                                          tabIndex: 0,
                                          'aria-label': `View transactions for ${format(day.date, 'MMMM d, yyyy')}`,
                                          onClick: () => handleDayClick(day),
                                          onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                  e.preventDefault()
                                                  handleDayClick(day)
                                              }
                                          },
                                      }
                                    : {})}
                                className={cn(
                                    "relative min-h-[100px] border-b border-r p-2 transition-colors cursor-default",
                                    hasTransactions && "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                                    !isSameMonth(day.date, currentDate) && "bg-muted/20 text-muted-foreground",
                                    isToday && "ring-1 ring-primary ring-inset bg-primary/5 font-semibold",
                                    idx % 7 === 0 && "border-l" // Left border for first column
                                )}
                            >
                                <span className={cn(
                                    "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                                    isToday && "bg-primary text-primary-foreground"
                                )}>
                                    {format(day.date, 'd')}
                                </span>

                            <div className="mt-2 space-y-1">
                                {day.summary.income > 0 && (
                                    <div className="flex items-center gap-1 rounded bg-[var(--income)]/10 px-1 py-0.5 text-[10px] text-[var(--income)]">
                                        <ArrowDownLeft className="h-3 w-3 shrink-0" aria-hidden="true" />
                                        {/* Compact below sm so wide amounts stop clipping */}
                                        <span className="sm:hidden tabular-nums">
                                            {formatCompactCurrency(day.summary.income, preferences.currency)}
                                        </span>
                                        <span className="hidden sm:inline tabular-nums">
                                            {formatCurrency(day.summary.income)}
                                        </span>
                                    </div>
                                )}
                                {day.summary.expense > 0 && (
                                    <div className="flex items-center gap-1 rounded bg-[var(--expense)]/10 px-1 py-0.5 text-[10px] text-[var(--expense)]">
                                        <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                                        <span className="sm:hidden tabular-nums">
                                            {formatCompactCurrency(day.summary.expense, preferences.currency)}
                                        </span>
                                        <span className="hidden sm:inline tabular-nums">
                                            {formatCurrency(day.summary.expense)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        )
                    })}
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Transactions for {selectedDate && format(selectedDate, 'MMM d, yyyy')}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedDayData?.transactions.length || 0} transactions found
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        {selectedDayData?.transactions.map((t) => (
                            <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                        t.type === 'income'
                                            ? "bg-[var(--income)]/10 text-[var(--income)]"
                                            : t.type === 'expense'
                                                ? "bg-[var(--expense)]/10 text-[var(--expense)]"
                                                : "bg-muted text-muted-foreground"
                                    )}>
                                        {t.type === 'income' ? (
                                            <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
                                        ) : t.type === 'expense' ? (
                                            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                                        ) : (
                                            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium truncate">{t.description || 'No description'}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {t.category?.name || 'Uncategorized'} • {t.account?.name}
                                        </div>
                                    </div>
                                </div>
                                <div className={cn(
                                    "shrink-0 font-semibold tabular-nums",
                                    t.type === 'income'
                                        ? "text-[var(--income)]"
                                        : t.type === 'expense'
                                            ? "text-[var(--expense)]"
                                            : "text-muted-foreground"
                                )}>
                                    {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '⇄'}
                                    {formatCurrency(toNumber(t.amount))}
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
