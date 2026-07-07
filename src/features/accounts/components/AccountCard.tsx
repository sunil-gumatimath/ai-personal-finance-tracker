import {
    Pencil,
    Trash2,
    Wallet,
    CreditCard,
    PiggyBank,
    Building,
    Banknote,
    LineChart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Account } from '@/types'

export const ACCOUNT_TYPES = [
    { value: 'checking', label: 'Checking Account', icon: Building, gradient: 'from-blue-500 to-blue-600' },
    { value: 'savings', label: 'Savings Account', icon: PiggyBank, gradient: 'from-emerald-500 to-emerald-600' },
    { value: 'credit', label: 'Credit Card', icon: CreditCard, gradient: 'from-purple-500 to-purple-600' },
    { value: 'investment', label: 'Investment', icon: LineChart, gradient: 'from-amber-500 to-orange-600' },
    { value: 'cash', label: 'Cash', icon: Banknote, gradient: 'from-green-500 to-green-600' },
    { value: 'other', label: 'Other', icon: Wallet, gradient: 'from-slate-500 to-slate-600' },
]

interface AccountCardProps {
    account: Account
    showBalances: boolean
    formatCurrency: (val: number) => string
    onEdit: (account: Account) => void
    onDelete: (account: Account) => void
}

export function AccountCard({
    account,
    showBalances,
    formatCurrency,
    onEdit,
    onDelete,
}: AccountCardProps) {
    const getAccountIcon = (type: string) => {
        const accountType = ACCOUNT_TYPES.find((t) => t.value === type)
        return accountType?.icon || Wallet
    }

    const Icon = getAccountIcon(account.type)
    const color = account.color

    if (!account.is_active) {
        return (
            <div className="group relative overflow-hidden rounded-xl border border-dashed border-border/50 bg-card/30 backdrop-blur-sm p-5 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                <div className="relative flex items-center justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 border border-border/50">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-secondary"
                            onClick={() => onEdit(account)}
                            title="Edit account"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                            onClick={() => onDelete(account)}
                            title="Delete account"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                <div className="space-y-3">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">{account.name}</p>
                        <span className="text-xl font-bold tabular-nums tracking-tight text-muted-foreground/80">
                            {showBalances ? formatCurrency(account.balance) : '••••••'}
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80 flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            <div
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20 pointer-events-none"
                style={{ backgroundColor: color }}
            />

            <div className="relative flex items-center justify-between mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-background/50">
                    <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-secondary"
                        onClick={() => onEdit(account)}
                        title="Edit account"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(account)}
                        title="Delete account"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <div className="relative flex-1 space-y-3">
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{account.name}</p>
                    <span className={cn(
                        "text-2xl font-bold tabular-nums tracking-tight",
                        account.balance >= 0 ? "text-foreground" : "text-rose-400"
                    )}>
                        {showBalances ? formatCurrency(account.balance) : '••••••'}
                    </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/30">
                    <Badge variant="secondary" className="text-xs font-medium">
                        {account.type.replace('_', ' ')}
                    </Badge>
                    <div
                        className="h-6 w-6 rounded-full border-2 border-background ring-1 ring-border/50"
                        style={{ backgroundColor: color }}
                    />
                </div>
            </div>
        </div>
    )
}
