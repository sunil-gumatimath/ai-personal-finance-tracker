import { useState, useEffect, useMemo, useCallback } from 'react'
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
    Repeat,
    Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { query, insertRecord, updateRecord, deleteRecord } from '@/lib/database'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { cn } from '@/lib/utils'
import type { Transaction, Category, Account } from '@/types'

export function Transactions() {
    const { user } = useAuth()
    const { formatCurrency } = usePreferences()
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
        is_recurring: false,
        recurring_frequency: '' as '' | 'daily' | 'weekly' | 'monthly' | 'yearly',
    })

    const fetchData = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            const [transactionsRes, categoriesRes, accountsRes] = await Promise.all([
                query<Transaction>(`
                    SELECT 
                        t.*, 
                        row_to_json(c.*) as category, 
                        row_to_json(a.*) as account 
                    FROM transactions t
                    LEFT JOIN categories c ON t.category_id = c.id
                    LEFT JOIN accounts a ON t.account_id = a.id
                    WHERE t.user_id = $1
                    ORDER BY t.date DESC
                `, [user.id]),
                query<Category>('SELECT * FROM categories WHERE user_id = $1', [user.id]),
                query<Account>('SELECT * FROM accounts WHERE user_id = $1 AND is_active = true', [user.id]),
            ])

            setTransactions(transactionsRes.rows || [])
            setCategories(categoriesRes.rows || [])
            setAccounts(accountsRes.rows || [])
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Failed to load transactions')
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            const matchesSearch =
                (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
                (t.category?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
            const matchesType = filterType === 'all' || t.type === filterType
            return matchesSearch && matchesType
        })
    }, [transactions, searchQuery, filterType])

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
                is_recurring: formData.is_recurring,
                recurring_frequency: formData.is_recurring ? formData.recurring_frequency || null : null,
            }

            if (editingTransaction) {
                await updateRecord('transactions', editingTransaction.id, transactionData)
                toast.success('Transaction updated successfully')
            } else {
                await insertRecord('transactions', transactionData)
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
            await deleteRecord('transactions', id)
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
            is_recurring: transaction.is_recurring || false,
            recurring_frequency: transaction.recurring_frequency || '',
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
            is_recurring: false,
            recurring_frequency: '',
        })
    }

    const handleExport = () => {
        // Helper function to properly escape CSV fields according to RFC 4180
        const escapeCSVField = (field: string | number | null | undefined): string => {
            if (field === null || field === undefined) return ''
            const str = String(field)
            // If field contains comma, newline, or quote, wrap in quotes and escape internal quotes
            if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
                return `"${str.replace(/"/g, '""')}"`
            }
            return str
        }

        const headers = ['Type', 'Description', 'Category', 'Account', 'Date', 'Amount']
        const csvRows = [
            headers.join(','),
            ...filteredTransactions.map(t => [
                escapeCSVField(t.type),
                escapeCSVField(t.description),
                escapeCSVField(t.category?.name),
                escapeCSVField(t.account?.name),
                escapeCSVField(t.date),
                escapeCSVField(t.amount)
            ].join(','))
        ]

        // Add BOM for Excel UTF-8 compatibility
        const BOM = '\uFEFF'
        const csvContent = BOM + csvRows.join('\r\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob)
            link.setAttribute('href', url)
            link.setAttribute('download', `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`)
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url) // Clean up the URL object
        }
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
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transactions</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Manage and track all your financial transactions
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExport} className="flex-1 sm:flex-none">
                        <Download className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Export CSV</span>
                        <span className="sm:hidden">Export</span>
                    </Button>
                    <Button
                        onClick={() => {
                            resetForm()
                            setIsDialogOpen(true)
                        }}
                        className="flex-1 sm:flex-none"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Add Transaction</span>
                        <span className="sm:hidden">Add</span>
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:bg-card/80">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                <div className="relative flex flex-col gap-4 sm:flex-row">
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
            </div>

            {/* Transactions Table */}
            <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-border hover:bg-card/80">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                <div className="relative p-6 pb-2">
                    <h3 className="text-base font-semibold">All Transactions</h3>
                </div>
                <div className="relative px-6 pb-6">
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
                        <>
                            {/* Mobile Card Layout */}
                            <div className="block md:hidden space-y-3">
                                {filteredTransactions.map((transaction) => (
                                    <div
                                        key={transaction.id}
                                        className="flex items-center justify-between rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/50"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div
                                                className={cn(
                                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                                                    transaction.type === 'income'
                                                        ? 'bg-green-500/10 text-green-500'
                                                        : transaction.type === 'expense'
                                                            ? 'bg-red-500/10 text-red-500'
                                                            : 'bg-blue-500/10 text-blue-500'
                                                )}
                                            >
                                                {transaction.type === 'income' ? (
                                                    <ArrowDownLeft className="h-5 w-5" />
                                                ) : (
                                                    <ArrowUpRight className="h-5 w-5" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">
                                                    {transaction.description || 'No description'}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{format(new Date(transaction.date), 'MMM d')}</span>
                                                    {transaction.category && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="truncate">{transaction.category.name}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span
                                                className={cn(
                                                    'font-semibold text-sm',
                                                    transaction.type === 'income' ? 'text-green-500' : 'text-red-500'
                                                )}
                                            >
                                                {transaction.type === 'income' ? '+' : '-'}
                                                {formatCurrency(Math.abs(transaction.amount))}
                                            </span>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table Layout */}
                            <div className="hidden md:block">
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
                                                    <div className="flex items-center gap-2">
                                                        {transaction.description || 'No description'}
                                                        {transaction.is_recurring && (
                                                            <Badge variant="outline" className="gap-1 text-xs">
                                                                <Repeat className="h-3 w-3" />
                                                                {transaction.recurring_frequency}
                                                            </Badge>
                                                        )}
                                                    </div>
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
                            </div>
                        </>
                    )}
                </div>
            </div>

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

                        {/* Recurring Transaction Section */}
                        <div className="space-y-3 rounded-lg border border-border p-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">Recurring Transaction</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Automatically repeat this transaction
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={formData.is_recurring}
                                    onClick={() => setFormData({
                                        ...formData,
                                        is_recurring: !formData.is_recurring,
                                        recurring_frequency: !formData.is_recurring ? 'monthly' : ''
                                    })}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                                        formData.is_recurring ? "bg-primary" : "bg-muted"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
                                            formData.is_recurring ? "translate-x-4" : "translate-x-0.5"
                                        )}
                                    />
                                </button>
                            </div>
                            {formData.is_recurring && (
                                <div className="space-y-2">
                                    <Label>Frequency</Label>
                                    <Select
                                        value={formData.recurring_frequency}
                                        onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'yearly') =>
                                            setFormData({ ...formData, recurring_frequency: value })
                                        }
                                    >
                                        <SelectTrigger>
                                            <Repeat className="mr-2 h-4 w-4 text-muted-foreground" />
                                            <SelectValue placeholder="Select frequency" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="daily">Daily</SelectItem>
                                            <SelectItem value="weekly">Weekly</SelectItem>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                            <SelectItem value="yearly">Yearly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
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
