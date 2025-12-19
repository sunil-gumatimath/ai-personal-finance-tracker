import { format } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { usePreferences } from '@/hooks/usePreferences'
import type { Transaction } from '@/types'
import { Link } from 'react-router-dom'
import type { Insight } from '@/hooks/useAIInsights'

interface RecentTransactionsProps {
    transactions: Transaction[]
    anomalies?: Insight[]
}

export function RecentTransactions({ transactions, anomalies = [] }: RecentTransactionsProps) {
    const { formatCurrency } = usePreferences()

    if (transactions.length === 0) {
        return (
            <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:bg-card/80">
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                {/* Header */}
                <div className="relative flex items-center justify-between mb-4">
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
                <div className="relative flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-2xl bg-muted/20 mb-3">
                        <ArrowUpRight className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h4 className="text-lg font-semibold">No transactions yet</h4>
                    <p className="mt-2 text-sm text-muted-foreground max-w-[250px]">
                        Start tracking your finances by adding your first transaction
                    </p>
                </div>

                {/* Decorative corner accent */}
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
            </div>
        )
    }

    return (
        <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:bg-card/80">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Receipt className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold">Recent Transactions</h3>
                        <p className="text-xs text-muted-foreground">Your latest activity</p>
                    </div>
                </div>
                <Link
                    to="/transactions"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                    View all
                    <ArrowRight className="h-3 w-3" />
                </Link>
            </div>

            {/* Transactions List */}
            <div className="relative space-y-3">
                {transactions.slice(0, 5).map((transaction) => {
                    const isAnomaly = anomalies.some(a => a.id === `anomaly-${transaction.id}`)

                    return (
                        <div
                            key={transaction.id}
                            className={cn(
                                'flex items-center justify-between rounded-xl border p-3 transition-all duration-200',
                                isAnomaly
                                    ? 'border-rose-500/50 bg-rose-500/[0.03] shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                                    : 'border-border/30 bg-background/30 hover:bg-background/50 hover:border-border/50'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={cn(
                                        'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
                                        transaction.type === 'income'
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : 'bg-rose-500/10 text-rose-400'
                                    )}
                                >
                                    {transaction.type === 'income' ? (
                                        <ArrowDownLeft className="h-5 w-5" />
                                    ) : (
                                        <ArrowUpRight className="h-5 w-5" />
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm">
                                            {transaction.description || transaction.category?.name || 'Transaction'}
                                        </p>
                                        {isAnomaly && (
                                            <Badge variant="destructive" className="h-4 px-1 text-[8px] font-black uppercase tracking-tighter animate-pulse">
                                                Anomaly
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {format(new Date(transaction.date), 'MMM d, yyyy')}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p
                                    className={cn(
                                        'font-semibold text-sm',
                                        transaction.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                                    )}
                                >
                                    {transaction.type === 'income' ? '+' : '-'}
                                    {formatCurrency(Math.abs(transaction.amount))}
                                </p>
                                {transaction.category && (
                                    <Badge
                                        variant="secondary"
                                        className="mt-1 text-[10px] bg-muted/50 border-border/50"
                                    >
                                        {transaction.category.name}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Footer hint */}
            {transactions.length > 5 && (
                <p className="relative text-xs text-muted-foreground text-center mt-4 pt-3 border-t border-border/30">
                    +{transactions.length - 5} more transactions
                </p>
            )}

            {/* Decorative corner accent */}
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
        </div>
    )
}
