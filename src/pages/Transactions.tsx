import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import {
    Plus,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownLeft,
    MoreHorizontal,
    Pencil,
    Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import type { Transaction, Category, Account } from '@/types'

export function Transactions() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<string>('all')
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
    const [formData, setFormData] = useState({
        type: 'expense' as 'income' | 'expense' | 'transfer',
        amount: '',
        description: '',
        category_id: '',
        account_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
    })

    useEffect(() => {
        fetchData()
    }, [user])

    async function fetchData() {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            const [transactionsRes, categoriesRes, accountsRes] = await Promise.all([
                supabase
                    .from('transactions')
                    .select(`
            *,
            category:categories(*),
            account:accounts(*)
          `)
                    .eq('user_id', user.id)
                    .order('date', { ascending: false }),
                supabase.from('categories').select('*').eq('user_id', user.id),
                supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
            ])

            if (transactionsRes.data) setTransactions(transactionsRes.data as Transaction[])
            if (categoriesRes.data) setCategories(categoriesRes.data)
            if (accountsRes.data) setAccounts(accountsRes.data)
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Failed to load transactions')
        } finally {
            setLoading(false)
        }
    }

    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            const matchesSearch =
                t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.category?.name.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesType = filterType === 'all' || t.type === filterType
            return matchesSearch && matchesType
        })
    }, [transactions, searchQuery, filterType])

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        try {
            const transactionData = {
                user_id: user.id,
                type: formData.type,
                amount: parseFloat(formData.amount),
                description: formData.description || null,
                category_id: formData.category_id || null,
                account_id: formData.account_id,
                date: formData.date,
            }

            if (editingTransaction) {
                const { error } = await supabase
                    .from('transactions')
                    .update(transactionData)
                    .eq('id', editingTransaction.id)

                if (error) throw error
                toast.success('Transaction updated successfully')
            } else {
                const { error } = await supabase.from('transactions').insert(transactionData)
                if (error) throw error
                toast.success('Transaction added successfully')
            }

            setIsDialogOpen(false)
            resetForm()
            fetchData()
        } catch (error) {
            console.error('Error saving transaction:', error)
            toast.error('Failed to save transaction')
        }
    }

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('transactions').delete().eq('id', id)
            if (error) throw error
            toast.success('Transaction deleted')
            fetchData()
        } catch (error) {
            console.error('Error deleting transaction:', error)
            toast.error('Failed to delete transaction')
        }
    }

    const handleEdit = (transaction: Transaction) => {
        setEditingTransaction(transaction)
        setFormData({
            type: transaction.type,
            amount: transaction.amount.toString(),
            description: transaction.description || '',
            category_id: transaction.category_id || '',
            account_id: transaction.account_id,
            date: transaction.date,
        })
        setIsDialogOpen(true)
    }

    const resetForm = () => {
        setEditingTransaction(null)
        setFormData({
            type: 'expense',
            amount: '',
            description: '',
            category_id: '',
            account_id: accounts[0]?.id || '',
            date: format(new Date(), 'yyyy-MM-dd'),
        })
    }

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
                    <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
                    <p className="text-muted-foreground">
                        Manage and track all your financial transactions
                    </p>
                </div>
                <Button
                    onClick={() => {
                        resetForm()
                        setIsDialogOpen(true)
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Transaction
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search transactions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="w-[140px]">
                                    <Filter className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder="Filter" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="income">Income</SelectItem>
                                    <SelectItem value="expense">Expense</SelectItem>
                                    <SelectItem value="transfer">Transfer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="rounded-full bg-muted p-4">
                                <ArrowUpRight className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="mt-4 text-lg font-semibold">No transactions found</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {searchQuery || filterType !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'Get started by adding your first transaction'}
                            </p>
                            {!searchQuery && filterType === 'all' && (
                                <Button
                                    className="mt-4"
                                    onClick={() => {
                                        resetForm()
                                        setIsDialogOpen(true)
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Transaction
                                </Button>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Account</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTransactions.map((transaction) => (
                                    <TableRow key={transaction.id}>
                                        <TableCell>
                                            <div
                                                className={cn(
                                                    'flex h-8 w-8 items-center justify-center rounded-full',
                                                    transaction.type === 'income'
                                                        ? 'bg-green-500/10 text-green-500'
                                                        : transaction.type === 'expense'
                                                            ? 'bg-red-500/10 text-red-500'
                                                            : 'bg-blue-500/10 text-blue-500'
                                                )}
                                            >
                                                {transaction.type === 'income' ? (
                                                    <ArrowDownLeft className="h-4 w-4" />
                                                ) : (
                                                    <ArrowUpRight className="h-4 w-4" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {transaction.description || 'No description'}
                                        </TableCell>
                                        <TableCell>
                                            {transaction.category ? (
                                                <Badge variant="secondary">{transaction.category.name}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{transaction.account?.name || '—'}</TableCell>
                                        <TableCell>
                                            {format(new Date(transaction.date), 'MMM d, yyyy')}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right font-semibold',
                                                transaction.type === 'income' ? 'text-green-500' : 'text-red-500'
                                            )}
                                        >
                                            {transaction.type === 'income' ? '+' : '-'}
                                            {formatCurrency(Math.abs(transaction.amount))}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEdit(transaction)}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => handleDelete(transaction.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingTransaction
                                ? 'Update the transaction details below.'
                                : 'Enter the details for your new transaction.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value: 'income' | 'expense' | 'transfer') =>
                                    setFormData({ ...formData, type: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="income">Income</SelectItem>
                                    <SelectItem value="expense">Expense</SelectItem>
                                    <SelectItem value="transfer">Transfer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                placeholder="What was this for?"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                                value={formData.category_id}
                                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories
                                        .filter((c) => c.type === formData.type || formData.type === 'transfer')
                                        .map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Account</Label>
                            <Select
                                value={formData.account_id}
                                onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id}>
                                            {account.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="date">Date</Label>
                            <Input
                                id="date"
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editingTransaction ? 'Update' : 'Add'} Transaction
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
