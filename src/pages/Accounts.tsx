import { useState, useEffect } from 'react'
import { Plus, Wallet, CreditCard, PiggyBank, Building, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
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
import { cn } from '@/lib/utils'
import type { Account } from '@/types'

const ACCOUNT_TYPES = [
    { value: 'checking', label: 'Checking Account', icon: Building },
    { value: 'savings', label: 'Savings Account', icon: PiggyBank },
    { value: 'credit', label: 'Credit Card', icon: CreditCard },
    { value: 'investment', label: 'Investment', icon: Wallet },
    { value: 'cash', label: 'Cash', icon: Wallet },
    { value: 'other', label: 'Other', icon: Wallet },
]

const COLORS = [
    '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

export function Accounts() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [accounts, setAccounts] = useState<Account[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingAccount, setEditingAccount] = useState<Account | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        type: 'checking' as Account['type'],
        balance: '',
        color: COLORS[0],
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount)
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
            color: COLORS[0],
            is_active: true,
        })
    }

    const totalBalance = accounts
        .filter((a) => a.is_active)
        .reduce((sum, a) => sum + a.balance, 0)

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
                    <p className="text-muted-foreground">
                        Manage your bank accounts, cards, and wallets
                    </p>
                </div>
                <Button
                    onClick={() => {
                        resetForm()
                        setIsDialogOpen(true)
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Account
                </Button>
            </div>

            {/* Total Balance Card */}
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Balance
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-bold">{formatCurrency(totalBalance)}</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Across {accounts.filter((a) => a.is_active).length} active accounts
                    </p>
                </CardContent>
            </Card>

            {/* Account Cards */}
            {accounts.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="rounded-full bg-muted p-4">
                            <Wallet className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold">No accounts yet</h3>
                        <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
                            Add your bank accounts, credit cards, and wallets to start tracking your finances
                        </p>
                        <Button
                            className="mt-4"
                            onClick={() => {
                                resetForm()
                                setIsDialogOpen(true)
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Your First Account
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {accounts.map((account) => {
                        const Icon = getAccountIcon(account.type)

                        return (
                            <Card
                                key={account.id}
                                className={cn(
                                    'relative overflow-hidden transition-all duration-300 hover:shadow-lg',
                                    !account.is_active && 'opacity-60'
                                )}
                            >
                                <div
                                    className="absolute left-0 top-0 h-full w-1"
                                    style={{ backgroundColor: account.color }}
                                />
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-full"
                                                style={{ backgroundColor: `${account.color}20` }}
                                            >
                                                <Icon className="h-5 w-5" style={{ color: account.color }} />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base">{account.name}</CardTitle>
                                                <CardDescription className="capitalize">
                                                    {account.type.replace('_', ' ')}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {!account.is_active && (
                                            <span className="text-xs text-muted-foreground">Inactive</span>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div
                                        className={cn(
                                            'text-2xl font-bold',
                                            account.balance >= 0 ? '' : 'text-red-500'
                                        )}
                                    >
                                        {formatCurrency(account.balance)}
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => {
                                                setEditingAccount(account)
                                                setFormData({
                                                    name: account.name,
                                                    type: account.type,
                                                    balance: account.balance.toString(),
                                                    color: account.color,
                                                    is_active: account.is_active,
                                                })
                                                setIsDialogOpen(true)
                                            }}
                                        >
                                            <Pencil className="mr-1 h-3 w-3" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(account.id)}
                                        >
                                            <Trash2 className="mr-1 h-3 w-3" />
                                            Delete
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingAccount ? 'Edit Account' : 'Add Account'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingAccount
                                ? 'Update your account details.'
                                : 'Add a new account to track your finances.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Account Name</Label>
                            <Input
                                id="name"
                                placeholder="My Checking Account"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Account Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value: Account['type']) =>
                                    setFormData({ ...formData, type: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ACCOUNT_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
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
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={cn(
                                            'h-8 w-8 rounded-full transition-transform hover:scale-110',
                                            formData.color === color && 'ring-2 ring-offset-2 ring-primary'
                                        )}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setFormData({ ...formData, color })}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="is_active">Active Account</Label>
                            <Switch
                                id="is_active"
                                checked={formData.is_active}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, is_active: checked })
                                }
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editingAccount ? 'Update' : 'Add'} Account
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
