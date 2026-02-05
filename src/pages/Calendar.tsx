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
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

// PostgreSQL DECIMAL may come back as a string; normalize before doing math
function toNumber(val: unknown): number {
    if (typeof val === 'number') return isNaN(val) ? 0 : val
    if (typeof val === 'string') {
        const parsed = parseFloat(val)
        return isNaN(parsed) ? 0 : parsed
    }
    return 0
}

// PostgreSQL DATE often comes back as 'YYYY-MM-DD'. `new Date('YYYY-MM-DD')` is UTC and can
// shift to the previous/next day in local timezones, so parse date-only values as local dates.
function parseTransactionDate(val: unknown): Date {
    if (val instanceof Date) return val
    if (typeof val === 'string') {
        const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(val)
        if (match) {
            const year = Number(match[1])
            const month = Number(match[2])
            const day = Number(match[3])
            return new Date(year, month - 1, day)
        }
        return new Date(val)
    }
    return new Date(NaN)
}

export function Calendar() {
    const { user } = useAuth()
    const { formatCurrency } = usePreferences()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const fetchTransactions = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

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
            const res = await api.transactions.list({ since: formatDateStr(start) })
            const rows = (res.transactions || []) as Transaction[]
            const endStr = formatDateStr(end)
            const filtered = rows.filter(t => String(t.date).split('T')[0] <= endStr)
            setTransactions(filtered)
        } catch (error) {
            console.error('Error fetching transactions:', error)
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
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
                    <Button variant="outline" size="icon" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-[140px] text-center font-medium">
                        {format(currentDate, 'MMMM yyyy')}
                    </div>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" onClick={resetToToday} className="ml-2">
                        Today
                    </Button>
                </div>
            </div>

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
                    {calendarGrid.map((day, idx) => (
                        <div
                            key={day.date.toString()}
                            onClick={() => handleDayClick(day)}
                            className={cn(
                                "relative min-h-[100px] border-b border-r p-2 transition-colors hover:bg-muted/50 cursor-pointer",
                                !isSameMonth(day.date, currentDate) && "bg-muted/20 text-muted-foreground",
                                isSameDay(day.date, new Date()) && "bg-primary/5 font-semibold",
                                idx % 7 === 0 && "border-l" // Left border for first column
                            )}
                        >
                            <span className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                                isSameDay(day.date, new Date()) && "bg-primary text-primary-foreground"
                            )}>
                                {format(day.date, 'd')}
                            </span>

                            <div className="mt-2 space-y-1">
                                {day.summary.income > 0 && (
                                    <div className="flex items-center gap-1 rounded bg-green-500/10 px-1 py-0.5 text-[10px] text-green-600 dark:text-green-400">
                                        <ArrowDownLeft className="h-3 w-3" />
                                        {formatCurrency(day.summary.income)}
                                    </div>
                                )}
                                {day.summary.expense > 0 && (
                                    <div className="flex items-center gap-1 rounded bg-red-500/10 px-1 py-0.5 text-[10px] text-red-600 dark:text-red-400">
                                        <ArrowUpRight className="h-3 w-3" />
                                        {formatCurrency(day.summary.expense)}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
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
                            <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full",
                                        t.type === 'income' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                    )}>
                                        {t.type === 'income' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <div className="font-medium">{t.description || 'No description'}</div>
                                        <div className="text-xs text-muted-foreground">{t.category?.name || 'Uncategorized'} • {t.account?.name}</div>
                                    </div>
                                </div>
                                <div className={cn(
                                    "font-semibold",
                                    t.type === 'income' ? "text-green-500" : "text-red-500"
                                )}>
                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(toNumber(t.amount))}
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
