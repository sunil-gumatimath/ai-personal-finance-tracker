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
import { Card } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

export function Calendar() {
    const { user } = useAuth()
    const { formatCurrency } = usePreferences()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const fetchTransactions = useCallback(async () => {
        if (!user) return

        const start = startOfWeek(startOfMonth(currentDate))
        const end = endOfWeek(endOfMonth(currentDate))

        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*, category:categories(*), account:accounts(*)')
                .eq('user_id', user.id)
                .gte('date', start.toISOString())
                .lte('date', end.toISOString())

            if (error) throw error
            if (data) setTransactions(data)
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
                isSameDay(new Date(t.date), day)
            )

            const income = dayTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0)

            const expense = dayTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0)

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
                    <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
                    <p className="text-muted-foreground">
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

            <Card className="overflow-hidden">
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
            </Card>

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
                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
