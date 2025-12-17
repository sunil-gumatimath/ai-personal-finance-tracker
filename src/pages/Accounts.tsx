import { useState, useEffect, useCallback } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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



export function Accounts() {
    const { user } = useAuth()
    const { formatCurrency, preferences } = usePreferences()
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

    const fetchAccounts = useCallback(async () => {
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
    }, [user])

    useEffect(() => {
        fetchAccounts()
    }, [fetchAccounts])

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
                currency: preferences.currency,
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
        return <LoadingSkeleton />
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div>
                                <h1 className="text-3xl font-black tracking-tight tracking-tighter sm:text-4xl">Accounts</h1>
                                <p className="text-sm font-medium text-muted-foreground">
                                    Manage your unified financial portfolio
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowBalances(!showBalances)}
                            className="h-11 w-11 rounded-xl bg-background/50 backdrop-blur-sm border-border/50"
                        >
                            {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button
                            onClick={() => {
                                resetForm()
                                setIsDialogOpen(true)
                            }}
                            className="h-11 rounded-xl px-6 gap-2 bg-primary shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-bold"
                        >
                            <Plus className="h-4 w-4" />
                            Add Account
                        </Button>
                    </div>
                </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl sm:col-span-2 group border-primary/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-[80px] group-hover:bg-primary/20 transition-colors duration-1000" />
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-amber-400" />
                                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Total Net Worth</CardTitle>
                            </div>
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 py-1 font-bold">
                                {activeAccounts.length} ACTIVE
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter tabular-nums bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                                {showBalances ? formatCurrency(totalBalance) : '••••••'}
                            </h2>
                            <div className="flex items-center gap-2 mt-2">
                                {totalBalance >= 0 ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 px-2 py-0.5 pointer-events-none font-bold">
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        SURPLUS
                                    </Badge>
                                ) : (
                                    <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20 px-2 py-0.5 pointer-events-none font-bold">
                                        <TrendingDown className="h-3 w-3 mr-1" />
                                        DEFICIT
                                    </Badge>
                                )}
                                <span className="text-xs font-medium text-muted-foreground">Total across all active units</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-border/50 bg-emerald-500/[0.03] backdrop-blur-md shadow-xl group border-emerald-500/20">
                    <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl group-hover:scale-125 transition-transform" />
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-emerald-500/70">Total Assets</CardTitle>
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <ArrowUpRight className="h-3.5 w-3.5" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-black tabular-nums text-emerald-500 tracking-tight">
                            {showBalances ? formatCurrency(totalAssets) : '••••••'}
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-border/50 bg-rose-500/[0.03] backdrop-blur-md shadow-xl group border-rose-500/20">
                    <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-rose-500/10 blur-3xl group-hover:scale-125 transition-transform" />
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-rose-500/70">Liabilities</CardTitle>
                            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                <ArrowDownRight className="h-3.5 w-3.5" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-black tabular-nums text-rose-500 tracking-tight">
                            {showBalances ? formatCurrency(totalLiabilities) : '••••••'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Active Accounts Section */}
            {activeAccounts.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-border/50 pb-4">
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">Active Accounts</h2>
                        <span className="text-xs font-bold text-muted-foreground">{activeAccounts.length} TOTAL</span>
                    </div>
                    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {activeAccounts.map((account) => {
                            const Icon = getAccountIcon(account.type)
                            const color = account.color
                            return (
                                <Card
                                    key={account.id}
                                    className="group relative overflow-hidden border-border/50 bg-card/30 backdrop-blur-xl transition-all duration-300 hover:border-border hover:shadow-2xl hover:-translate-y-1 flex flex-col"
                                >
                                    <div
                                        className="absolute -right-12 -top-12 h-40 w-40 rounded-full blur-[50px] opacity-10 transition-opacity group-hover:opacity-20 pointer-events-none"
                                        style={{ backgroundColor: color }}
                                    />

                                    <CardHeader className="pb-6">
                                        <div className="flex items-center justify-between">
                                            <div
                                                className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/50 border border-border/50 shadow-inner group-hover:scale-110 transition-transform"
                                            >
                                                <Icon className="h-6 w-6" style={{ color }} />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 opacity-50 hover:opacity-100 rounded-lg">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 rounded-xl ring-1 ring-border border-0 shadow-2xl">
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
                                                        <Pencil className="mr-2 h-4 w-4 opacity-70" /> Edit Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-rose-500 focus:text-rose-500"
                                                        onClick={() => handleDelete(account.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="flex-1 space-y-6">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Current Balance</p>
                                            <h3 className={cn(
                                                "text-3xl font-black tabular-nums tracking-tighter transition-all group-hover:scale-105 origin-left",
                                                account.balance >= 0 ? "text-foreground" : "text-rose-500"
                                            )}>
                                                {showBalances ? formatCurrency(account.balance) : '••••••'}
                                            </h3>
                                        </div>

                                        <div className="flex items-center justify-between pt-6 border-t border-border/30">
                                            <div className="min-w-0">
                                                <CardTitle className="text-base font-bold truncate text-foreground">{account.name}</CardTitle>
                                                <Badge variant="secondary" className="mt-1 text-[9px] font-black tracking-widest uppercase py-0 px-1.5 h-4 border-0">
                                                    {account.type.replace('_', ' ')}
                                                </Badge>
                                            </div>
                                            <div
                                                className="h-8 w-8 rounded-full border-2 border-background shadow-xl ring-1 ring-border/50"
                                                style={{ backgroundColor: color }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            {inactiveAccounts.length > 0 && (
                <div className="space-y-6 pt-6">
                    <div className="flex items-center justify-between border-b border-border/50 pb-4">
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Inactive Accounts</h2>
                    </div>
                    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {inactiveAccounts.map((account) => {
                            const Icon = getAccountIcon(account.type)
                            return (
                                <Card
                                    key={account.id}
                                    className="group relative overflow-hidden border-dashed opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all border-border/50 bg-background/20"
                                >
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 border border-border/50">
                                                <Icon className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 rounded-xl">
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
                                    <CardContent className="space-y-4 pt-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Archived Balance</p>
                                            <h3 className="text-xl font-black text-muted-foreground/80 tracking-tighter">
                                                {showBalances ? formatCurrency(account.balance) : '••••••'}
                                            </h3>
                                        </div>
                                        <div className="pt-4 border-t border-border/30">
                                            <CardTitle className="text-sm font-bold text-muted-foreground">{account.name}</CardTitle>
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
                <Card className="border-2 border-dashed border-border/50 bg-background/50 rounded-3xl overflow-hidden group">
                    <CardContent className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full scale-150 group-hover:bg-primary/30 transition-colors" />
                            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary text-primary border border-primary/20 shadow-2xl">
                                <Wallet className="h-10 w-10" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-black tracking-tight mb-2">Build your portfolio</h3>
                        <p className="text-muted-foreground max-w-sm mb-10 font-medium">
                            Synthesize your finances by adding your first account. Connect banks, wallets, or crypto.
                        </p>
                        <Button
                            onClick={() => {
                                resetForm()
                                setIsDialogOpen(true)
                            }}
                            className="h-12 px-10 rounded-2xl gap-2 bg-primary shadow-xl shadow-primary/20 font-black tracking-wide"
                        >
                            <Plus className="h-5 w-5" />
                            DEPLOY NEW ACCOUNT
                        </Button>
                    </CardContent>
                </Card>
            )}

            {accounts.length > 0 && (
                <button
                    onClick={() => {
                        resetForm()
                        setIsDialogOpen(true)
                    }}
                    className="flex w-full items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border/50 bg-card/20 p-12 transition-all hover:border-primary/50 hover:bg-primary/5 group"
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary border border-border/50 shadow-sm transition-all group-hover:scale-110 group-hover:border-primary/30">
                        <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="font-black text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-[0.2em] text-xs">
                        Add Another Financial Unit
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

function LoadingSkeleton() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-11 w-11 rounded-xl" />
                        <Skeleton className="h-11 w-32 rounded-xl" />
                    </div>
                </div>
            </div>

            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-48 rounded-3xl sm:col-span-2" />
                <Skeleton className="h-48 rounded-3xl" />
                <Skeleton className="h-48 rounded-3xl" />
            </div>

            <div className="space-y-6">
                <Skeleton className="h-6 w-32" />
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-64 rounded-3xl" />
                    ))}
                </div>
            </div>
        </div>
    )
}
