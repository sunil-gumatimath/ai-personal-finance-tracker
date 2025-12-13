import { format } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

interface RecentTransactionsProps {
    transactions: Transaction[]
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount)
    }

    if (transactions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="rounded-full bg-muted p-4">
                            <ArrowUpRight className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold">No transactions yet</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Start tracking your finances by adding your first transaction
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {transactions.slice(0, 5).map((transaction) => (
                    <div
                        key={transaction.id}
                        className="flex items-center justify-between rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/50"
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={cn(
                                    'flex h-10 w-10 items-center justify-center rounded-full',
                                    transaction.type === 'income'
                                        ? 'bg-green-500/10 text-green-500'
                                        : 'bg-red-500/10 text-red-500'
                                )}
                            >
                                {transaction.type === 'income' ? (
                                    <ArrowDownLeft className="h-5 w-5" />
                                ) : (
                                    <ArrowUpRight className="h-5 w-5" />
                                )}
                            </div>
                            <div>
                                <p className="font-medium">
                                    {transaction.description || transaction.category?.name || 'Transaction'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {format(new Date(transaction.date), 'MMM d, yyyy')}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p
                                className={cn(
                                    'font-semibold',
                                    transaction.type === 'income' ? 'text-green-500' : 'text-red-500'
                                )}
                            >
                                {transaction.type === 'income' ? '+' : '-'}
                                {formatCurrency(Math.abs(transaction.amount))}
                            </p>
                            {transaction.category && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                    {transaction.category.name}
                                </Badge>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
