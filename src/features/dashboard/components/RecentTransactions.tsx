import { format } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Receipt, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { usePreferences } from '@/hooks/usePreferences'
import { parseTransactionDate } from '@/lib/date-utils'
import { toNumber } from '@/lib/number'
import type { Transaction } from '@/types'
import { Link } from 'react-router-dom'
import type { Insight } from '@/hooks/useAIInsights'

interface RecentTransactionsProps {
    transactions: Transaction[]
    anomalies?: Insight[]
    /** While the parent fetch is in flight — mirrors the loaded list layout. */
    isLoading?: boolean
}

// Keep in sync with the Dashboard's slice — the parent caps at 10.
const MAX_ROWS = 10

export function RecentTransactions({ transactions, anomalies = [], isLoading = false }: RecentTransactionsProps) {
    const { formatCurrency } = usePreferences()

    // Loading skeleton mirrors the loaded rows
    if (isLoading) {
        return (
            <div className="rounded-2xl border border-border bg-card p-6" aria-busy="true">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-9 w-9 rounded-xl" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-3 w-28" />
                        </div>
                    </div>
                </div>
                <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl border border-border/30 p-3">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-xl" />
                                <div className="space-y-1.5">
                                    <Skeleton className="h-3.5 w-32" />
                                    <Skeleton className="h-2.5 w-20" />
                                </div>
                            </div>
                            <Skeleton className="h-3.5 w-16" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (transactions.length === 0) {
        return (
            <div className="rounded-2xl border border-border bg-card p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <Receipt className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold">Recent Transactions</h3>
                            <p className="text-xs text-muted-foreground">Your latest activity</p>
                        </div>
                    </div>
                </div>

                {/* Empty State */}
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-2xl bg-muted/20 mb-3">
                        <ArrowUpRight className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h4 className="text-lg font-semibold">No transactions yet</h4>
                    <p className="mt-2 mb-4 text-sm text-muted-foreground max-w-[250px]">
                        Start tracking your finances by adding your first transaction
                    </p>
                    <Button asChild size="sm" variant="outline" className="gap-2 active:scale-[0.98]">
                        <Link to="/transactions?action=new">
                            <Plus className="h-4 w-4" />
                            Add your first transaction
                        </Link>
                    </Button>
                </div>
            </div>
        )
    }

    const visibleTransactions = transactions.slice(0, MAX_ROWS)

    return (
        <div className="rounded-2xl border border-border bg-card p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary border border-border/10">
                        <Receipt className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold">Recent Transactions</h3>
                        <p className="text-xs text-muted-foreground">Your latest activity</p>
                    </div>
                </div>
                <Link
                    to="/transactions"
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 py-0.5 active:scale-[0.98]"
                >
                    View all
                    <ArrowRight className="h-3 w-3" />
                </Link>
            </div>

            {/* Transactions List — each row deep-links into the transactions page */}
            <div className="space-y-3">
                {visibleTransactions.map((transaction) => {
                    const isAnomaly = anomalies.some(a => a.id === `anomaly-${transaction.id}`)
                    const isIncome = transaction.type === 'income'

                    return (
                        <Link
                            key={transaction.id}
                            to="/transactions"
                            aria-label={`${isIncome ? 'Income' : 'Expense'}: ${transaction.description || transaction.category?.name || 'Transaction'}, ${formatCurrency(Math.abs(toNumber(transaction.amount)))}`}
                            className={cn(
                                'group flex items-center justify-between gap-3 rounded-xl border p-3 min-w-0 transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                isAnomaly
                                    ? 'border-destructive/30 bg-destructive/[0.04]'
                                    : 'border-border/30 bg-background/20'
                            )}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className={cn(
                                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                                        isIncome
                                            ? 'bg-[var(--income)]/10 text-[var(--income)] border-[var(--income)]/10'
                                            : 'bg-[var(--expense)]/10 text-[var(--expense)] border-[var(--expense)]/10'
                                    )}
                                >
                                    {isIncome ? (
                                        <ArrowDownLeft className="h-5 w-5" />
                                    ) : (
                                        <ArrowUpRight className="h-5 w-5" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <p className="font-medium text-sm truncate">
                                            {transaction.description || transaction.category?.name || 'Transaction'}
                                        </p>
                                        {/* Static badge — pulsing alerts read as broken, not urgent */}
                                        {isAnomaly && (
                                            <Badge
                                                variant="destructive"
                                                className="h-4 shrink-0 px-1 text-[10px] font-bold uppercase tracking-tight"
                                            >
                                                Anomaly
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {format(parseTransactionDate(transaction.date), 'MMM d, yyyy')}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p
                                    className={cn(
                                        'font-semibold text-sm',
                                        isIncome ? 'text-[var(--income)]' : 'text-[var(--expense)]'
                                    )}
                                >
                                    {isIncome ? '+' : '-'}
                                    {formatCurrency(Math.abs(toNumber(transaction.amount)))}
                                </p>
                                {transaction.category && (
                                    <Badge
                                        variant="secondary"
                                        className="mt-1 max-w-[140px] text-[10px] bg-muted/50 border-border/50"
                                    >
                                        <span className="truncate">{transaction.category.name}</span>
                                    </Badge>
                                )}
                            </div>
                        </Link>
                    )
                })}
            </div>

            {/* Footer — honest link instead of a "+N more" count the parent truncates */}
            <div className="mt-4 pt-3 border-t border-border/30 text-center">
                <Link
                    to="/transactions"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 py-0.5 active:scale-[0.98]"
                >
                    View all transactions
                    <ArrowRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    )
}
