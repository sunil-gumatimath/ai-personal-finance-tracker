import { useState, useEffect } from 'react'
import {
    Plus,
    Wallet,
    CreditCard,
    PiggyBank,
    Building,
    Pencil,
    Trash2,
    MoreHorizontal,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    Banknote,
    LineChart,
    Eye,
    EyeOff,
    Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { cn } from '@/lib/utils'
import type { Account } from '@/types'

const ACCOUNT_TYPES = [
    { value: 'checking', label: 'Checking Account', icon: Building, gradient: 'from-blue-500 to-blue-600' },
    { value: 'savings', label: 'Savings Account', icon: PiggyBank, gradient: 'from-emerald-500 to-emerald-600' },
    { value: 'credit', label: 'Credit Card', icon: CreditCard, gradient: 'from-purple-500 to-purple-600' },
    { value: 'investment', label: 'Investment', icon: LineChart, gradient: 'from-amber-500 to-orange-600' },
    { value: 'cash', label: 'Cash', icon: Banknote, gradient: 'from-green-500 to-green-600' },
    { value: 'other', label: 'Other', icon: Wallet, gradient: 'from-slate-500 to-slate-600' },
]

const COLORS = [
    { value: '#3b82f6', name: 'Blue', gradient: 'from-blue-500 to-blue-600' },
    { value: '#22c55e', name: 'Green', gradient: 'from-emerald-500 to-emerald-600' },
    { value: '#8b5cf6', name: 'Purple', gradient: 'from-purple-500 to-violet-600' },
    { value: '#f59e0b', name: 'Amber', gradient: 'from-amber-500 to-orange-500' },
    { value: '#ef4444', name: 'Red', gradient: 'from-red-500 to-rose-600' },
    { value: '#ec4899', name: 'Pink', gradient: 'from-pink-500 to-rose-500' },
    { value: '#06b6d4', name: 'Cyan', gradient: 'from-cyan-500 to-teal-500' },
    { value: '#84cc16', name: 'Lime', gradient: 'from-lime-500 to-green-500' },
    { value: '#f97316', name: 'Orange', gradient: 'from-orange-500 to-red-500' },
    { value: '#6366f1', name: 'Indigo', gradient: 'from-indigo-500 to-purple-500' },
]

const getGradientForColor = (color: string) => {
    const found = COLORS.find(c => c.value === color)
    return found?.gradient || 'from-slate-500 to-slate-600'
}

export function Accounts() {
    const { user } = useAuth()
    const { formatCurrency } = usePreferences()
    const [loading, setLoading] = useState(true)
    const [accounts, setAccounts] = useState<Account[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingAccount, setEditingAccount] = useState<Account | null>(null)
    const [showBalances, setShowBalances] = useState(true)
    const [formData, setFormData] = useState({
        name: '',
        type: 'checking' as Account['type'],
        balance: '',
        color: COLORS[0].value,
        is_active: true,
    })

    useEffect(() => {
        fetchAccounts()
    }, [user])

    async function fetchAccounts() {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            const { data, error } = await supabase
                .from('accounts')
                .select('*')
                .eq('user_id', user.id)
                .order('is_active', { ascending: false })
                .order('name')

            if (error) throw error
            setAccounts(data || [])
        } catch (error) {
            console.error('Error fetching accounts:', error)
            toast.error('Failed to load accounts')
        } finally {
            setLoading(false)
        }
    }

    const getAccountIcon = (type: string) => {
        const accountType = ACCOUNT_TYPES.find((t) => t.value === type)
        return accountType?.icon || Wallet
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        try {
            const accountData = {
                user_id: user.id,
                name: formData.name,
                type: formData.type,
                balance: parseFloat(formData.balance) || 0,
                color: formData.color,
                icon: formData.type,
                is_active: formData.is_active,
                currency: 'USD',
            }

            if (editingAccount) {
                const { error } = await supabase
                    .from('accounts')
                    .update(accountData)
                    .eq('id', editingAccount.id)

                if (error) throw error
                toast.success('Account updated successfully')
            } else {
                const { error } = await supabase.from('accounts').insert(accountData)
                if (error) throw error
                toast.success('Account created successfully')
            }

            setIsDialogOpen(false)
            resetForm()
            fetchAccounts()
        } catch (error) {
            console.error('Error saving account:', error)
            toast.error('Failed to save account')
        }
    }

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('accounts').delete().eq('id', id)
            if (error) throw error
            toast.success('Account deleted')
            fetchAccounts()
        } catch (error) {
            console.error('Error deleting account:', error)
            toast.error('Failed to delete account. It may have transactions.')
        }
    }

    const resetForm = () => {
        setEditingAccount(null)
        setFormData({
            name: '',
            type: 'checking',
            balance: '',
            color: COLORS[0].value,
            is_active: true,
        })
    }

    const activeAccounts = accounts.filter((a) => a.is_active)
    const inactiveAccounts = accounts.filter((a) => !a.is_active)
    const totalBalance = activeAccounts.reduce((sum, a) => sum + a.balance, 0)
    const totalAssets = activeAccounts.filter(a => a.balance > 0).reduce((sum, a) => sum + a.balance, 0)
    const totalLiabilities = Math.abs(activeAccounts.filter(a => a.balance < 0).reduce((sum, a) => sum + a.balance, 0))

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                    <p className="text-sm text-muted-foreground animate-pulse">Loading your accounts...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/25">
                                <Wallet className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
                                <p className="text-muted-foreground">
                                    Manage your financial accounts in one place
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowBalances(!showBalances)}
                            className="h-10 w-10"
                        >
                            {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button
                            onClick={() => {
                                resetForm()
                                setIsDialogOpen(true)
                            }}
                            className="gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
                        >
                            <Plus className="h-4 w-4" />
                            Add Account
                        </Button>
                    </div>
                </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Net Worth Card */}
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl col-span-2">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
                    <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/5 blur-3xl" />
                    <div className="absolute -left-20 -bottom-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
                    <CardHeader className="relative pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-medium text-white/80">Net Worth</CardTitle>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                                <Sparkles className="h-4 w-4 text-amber-400" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold tracking-tight">
                                {showBalances ? formatCurrency(totalBalance) : '••••••'}
                            </span>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm">
                            <span className="text-white/60">
                                {activeAccounts.length} active account{activeAccounts.length !== 1 ? 's' : ''}
                            </span>
                            {totalBalance >= 0 ? (
                                <span className="flex items-center gap-1 text-emerald-400">
                                    <TrendingUp className="h-3 w-3" />
                                    Positive
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-rose-400">
                                    <TrendingDown className="h-3 w-3" />
                                    Negative
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Assets Card */}
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 shadow-lg">
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                                <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {showBalances ? formatCurrency(totalAssets) : '••••••'}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Positive balance accounts
                        </p>
                    </CardContent>
                </Card>

                {/* Liabilities Card */}
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-rose-500/10 to-rose-500/5 shadow-lg">
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-rose-500/10 blur-2xl" />
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Liabilities</CardTitle>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20">
                                <ArrowDownRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                            {showBalances ? formatCurrency(totalLiabilities) : '••••••'}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Credit & negative balances
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Active Accounts Section */}
            {activeAccounts.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Active Accounts</h2>
                        <span className="text-sm text-muted-foreground">{activeAccounts.length} accounts</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {activeAccounts.map((account) => {
                            const Icon = getAccountIcon(account.type)
                            const gradient = getGradientForColor(account.color)
                            return (
                                <Card
                                    key={account.id}
                                    className={cn(
                                        "group relative overflow-hidden border-0 transition-all duration-300",
                                        "hover:shadow-xl hover:-translate-y-1"
                                    )}
                                >
                                    {/* Gradient Header */}
                                    <div className={cn(
                                        "absolute inset-x-0 top-0 h-24 bg-gradient-to-br opacity-90",
                                        gradient
                                    )} />
                                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-t from-background/80 to-transparent" />

                                    {/* Decorative elements */}
                                    <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-white/10 blur-2xl transition-all group-hover:bg-white/20" />

                                    <CardHeader className="relative pb-12 pt-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-lg">
                                                <Icon className="h-6 w-6 text-white" />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-white/80 hover:bg-white/20 hover:text-white"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem onClick={() => {
                                                        setEditingAccount(account)
                                                        setFormData({
                                                            name: account.name,
                                                            type: account.type,
                                                            balance: account.balance.toString(),
                                                            color: account.color,
                                                            is_active: account.is_active,
                                                        })
                                                        setIsDialogOpen(true)
                                                    }}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Edit Account
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={() => handleDelete(account.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="relative space-y-4 pt-0">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Current Balance</p>
                                            <h3 className={cn(
                                                "text-2xl font-bold tracking-tight",
                                                account.balance >= 0 ? "text-foreground" : "text-rose-500"
                                            )}>
                                                {showBalances ? formatCurrency(account.balance) : '••••••'}
                                            </h3>
                                        </div>

                                        <div className="flex items-end justify-between border-t pt-4">
                                            <div>
                                                <p className="font-semibold text-foreground">{account.name}</p>
                                                <p className="text-sm text-muted-foreground capitalize">
                                                    {account.type.replace('_', ' ')}
                                                </p>
                                            </div>
                                            <div
                                                className="h-3 w-3 rounded-full ring-2 ring-offset-2 ring-offset-background"
                                                style={{ backgroundColor: account.color }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Inactive Accounts Section */}
            {inactiveAccounts.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-muted-foreground">Inactive Accounts</h2>
                        <span className="text-sm text-muted-foreground">{inactiveAccounts.length} accounts</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {inactiveAccounts.map((account) => {
                            const Icon = getAccountIcon(account.type)
                            return (
                                <Card
                                    key={account.id}
                                    className="group relative overflow-hidden border-dashed opacity-60 transition-all duration-300 hover:opacity-80"
                                >
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                                <Icon className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem onClick={() => {
                                                        setEditingAccount(account)
                                                        setFormData({
                                                            name: account.name,
                                                            type: account.type,
                                                            balance: account.balance.toString(),
                                                            color: account.color,
                                                            is_active: account.is_active,
                                                        })
                                                        setIsDialogOpen(true)
                                                    }}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Edit Account
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => handleDelete(account.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Balance</p>
                                            <h3 className="text-xl font-semibold text-muted-foreground">
                                                {showBalances ? formatCurrency(account.balance) : '••••••'}
                                            </h3>
                                        </div>
                                        <div className="flex items-center justify-between pt-2">
                                            <div>
                                                <p className="font-medium">{account.name}</p>
                                                <p className="text-xs text-muted-foreground capitalize">
                                                    {account.type.replace('_', ' ')} • Inactive
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Empty State / Add New Account Card */}
            {accounts.length === 0 && (
                <Card className="border-2 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                            <Wallet className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="mt-6 text-xl font-semibold">No accounts yet</h3>
                        <p className="mt-2 text-center text-muted-foreground max-w-sm">
                            Add your first account to start tracking your finances. You can add bank accounts, credit cards, investments, and more.
                        </p>
                        <Button
                            onClick={() => {
                                resetForm()
                                setIsDialogOpen(true)
                            }}
                            className="mt-6 gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Add Your First Account
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Quick Add Card - Only show when there are existing accounts */}
            {accounts.length > 0 && (
                <button
                    onClick={() => {
                        resetForm()
                        setIsDialogOpen(true)
                    }}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-8 transition-all duration-300 hover:border-primary/50 hover:bg-primary/5 group"
                >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm transition-transform group-hover:scale-110">
                        <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        Add Another Account
                    </span>
                </button>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingAccount ? (
                                <>
                                    <Pencil className="h-5 w-5 text-primary" />
                                    Edit Account
                                </>
                            ) : (
                                <>
                                    <Plus className="h-5 w-5 text-primary" />
                                    Add New Account
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {editingAccount
                                ? 'Update your account details below.'
                                : 'Add a new account to track your finances.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Account Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., My Savings Account"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="h-11"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Account Type</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(value: Account['type']) =>
                                            setFormData({ ...formData, type: value })
                                        }
                                    >
                                        <SelectTrigger className="h-11">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ACCOUNT_TYPES.map((type) => {
                                                const Icon = type.icon
                                                return (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        <div className="flex items-center gap-2">
                                                            <Icon className="h-4 w-4" />
                                                            {type.label}
                                                        </div>
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="balance">Current Balance</Label>
                                    <Input
                                        id="balance"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formData.balance}
                                        onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                                        className="h-11"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Account Color</Label>
                                <div className="flex flex-wrap gap-2">
                                    {COLORS.map((color) => (
                                        <button
                                            key={color.value}
                                            type="button"
                                            className={cn(
                                                'h-9 w-9 rounded-full transition-all duration-200 hover:scale-110',
                                                formData.color === color.value
                                                    ? 'ring-2 ring-offset-2 ring-primary scale-110'
                                                    : 'ring-1 ring-inset ring-black/10'
                                            )}
                                            style={{ backgroundColor: color.value }}
                                            onClick={() => setFormData({ ...formData, color: color.value })}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="is_active" className="text-base">Active Account</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Include this account in your total balance
                                    </p>
                                </div>
                                <Switch
                                    id="is_active"
                                    checked={formData.is_active}
                                    onCheckedChange={(checked) =>
                                        setFormData({ ...formData, is_active: checked })
                                    }
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="gap-2">
                                {editingAccount ? 'Update Account' : 'Add Account'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
