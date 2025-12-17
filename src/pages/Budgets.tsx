import { useState, useEffect, useCallback } from 'react'
import { Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { cn } from '@/lib/utils'
import type { Budget, Category } from '@/types'

export function Budgets() {
    const { user } = useAuth()
    const { formatCurrency } = usePreferences()
    const [loading, setLoading] = useState(true)
    const [budgets, setBudgets] = useState<Budget[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
    const [formData, setFormData] = useState({
        category_id: '',
        amount: '',
        period: 'monthly' as 'weekly' | 'monthly' | 'yearly',
    })

    const fetchData = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            // Helper to get local date string (YYYY-MM-DD) to avoid timezone issues
            const getLocalDateString = (date: Date): string => {
                const year = date.getFullYear()
                const month = String(date.getMonth() + 1).padStart(2, '0')
                const day = String(date.getDate()).padStart(2, '0')
                return `${year}-${month}-${day}`
            }

            // Calculate period start dates using local time
            const now = new Date()
            const startOfWeek = new Date(now)
            startOfWeek.setDate(now.getDate() - now.getDay())
            startOfWeek.setHours(0, 0, 0, 0)

            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const startOfYear = new Date(now.getFullYear(), 0, 1)

            // Get the earliest possible start date (start of year) for a single query
            const earliestStartDate = getLocalDateString(startOfYear)

            const [budgetsRes, categoriesRes, transactionsRes] = await Promise.all([
                supabase
                    .from('budgets')
                    .select(`*, category:categories(*)`)
                    .eq('user_id', user.id),
                supabase.from('categories').select('*').eq('user_id', user.id).eq('type', 'expense'),
                // Single query for all expense transactions from start of year
                supabase
                    .from('transactions')
                    .select('amount, category_id, date')
                    .eq('user_id', user.id)
                    .eq('type', 'expense')
                    .gte('date', earliestStartDate),
            ])

            if (budgetsRes.data && transactionsRes.data) {
                // Group transactions by category for efficient lookup
                const transactionsByCategory = new Map<string, { amount: number; date: string }[]>()
                for (const t of transactionsRes.data) {
                    if (!t.category_id) continue
                    const existing = transactionsByCategory.get(t.category_id) || []
                    existing.push({ amount: t.amount, date: t.date })
                    transactionsByCategory.set(t.category_id, existing)
                }

                // Calculate spent for each budget using in-memory data
                const budgetsWithSpent = budgetsRes.data.map((budget) => {
                    let startDateStr: string
                    switch (budget.period) {
                        case 'weekly':
                            startDateStr = getLocalDateString(startOfWeek)
                            break
                        case 'yearly':
                            startDateStr = getLocalDateString(startOfYear)
                            break
                        default: // monthly
                            startDateStr = getLocalDateString(startOfMonth)
                    }

                    const categoryTransactions = transactionsByCategory.get(budget.category_id) || []
                    const spent = categoryTransactions
                        .filter(t => t.date >= startDateStr)
                        .reduce((sum, t) => sum + t.amount, 0)

                    return { ...budget, spent }
                })

                setBudgets(budgetsWithSpent as Budget[])
            }

            if (categoriesRes.data) setCategories(categoriesRes.data)
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Failed to load budgets')
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const getProgressColor = (spent: number, budget: number) => {
        const percentage = (spent / budget) * 100
        if (percentage >= 100) return 'var(--color-red-500)'
        if (percentage >= 80) return 'var(--color-yellow-500)'
        return 'var(--color-green-500)'
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        try {
            const now = new Date()
            const budgetData = {
                user_id: user.id,
                category_id: formData.category_id,
                amount: parseFloat(formData.amount),
                period: formData.period,
                start_date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
            }

            if (editingBudget) {
                const { error } = await supabase
                    .from('budgets')
                    .update(budgetData)
                    .eq('id', editingBudget.id)

                if (error) throw error
                toast.success('Budget updated successfully')
            } else {
                const { error } = await supabase.from('budgets').insert(budgetData)
                if (error) throw error
                toast.success('Budget created successfully')
            }

            setIsDialogOpen(false)
            resetForm()
            fetchData()
        } catch (error) {
            console.error('Error saving budget:', error)
            toast.error('Failed to save budget')
        }
    }

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('budgets').delete().eq('id', id)
            if (error) throw error
            toast.success('Budget deleted')
            fetchData()
        } catch (error) {
            console.error('Error deleting budget:', error)
            toast.error('Failed to delete budget')
        }
    }

    const resetForm = () => {
        setEditingBudget(null)
        setFormData({
            category_id: '',
            amount: '',
            period: 'monthly',
        })
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0)
    const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Budgets</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Set spending limits and track your progress
                    </p>
                </div>
                <Button
                    onClick={() => {
                        resetForm()
                        setIsDialogOpen(true)
                    }}
                    className="w-full sm:w-auto"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Budget
                </Button>
            </div>

            {/* Overview Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Budget</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-primary">
                            <Target className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-2xl font-bold tracking-tight text-foreground">
                            {formatCurrency(totalBudget)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <span>Monthly limit</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">This month</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Spent</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-rose-400">
                            <span>
                                {totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(0)}%` : '0%'}
                            </span>
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-2xl font-bold tracking-tight text-foreground">
                            {formatCurrency(totalSpent)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-rose-400">
                        <span>
                            {totalBudget > 0
                                ? `${((totalSpent / totalBudget) * 100).toFixed(0)}% of budget`
                                : 'No budgets set'}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">Spent this period</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-rose-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Remaining</span>
                        <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                            totalBudget - totalSpent >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                            <span>{totalBudget - totalSpent >= 0 ? '+' : ''}{((totalBudget - totalSpent) / totalBudget * 100 || 0).toFixed(0)}%</span>
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className={cn(
                            "text-2xl font-bold tracking-tight",
                            totalBudget - totalSpent >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {formatCurrency(totalBudget - totalSpent)}
                        </span>
                    </div>
                    <div className={cn(
                        "flex items-center gap-1.5 text-sm font-medium",
                        totalBudget - totalSpent >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                        <span>{totalBudget - totalSpent >= 0 ? 'Under budget' : 'Over budget'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">Available to spend</p>
                    <div className={cn(
                        "absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20",
                        totalBudget - totalSpent >= 0 ? "bg-emerald-500" : "bg-rose-500"
                    )} />
                </div>
            </div>

            {/* Budget Cards */}
            {budgets.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="rounded-full bg-muted p-4">
                            <Target className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold">No budgets yet</h3>
                        <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
                            Create budgets to set spending limits for different categories and track your progress
                        </p>
                        <Button
                            className="mt-4"
                            onClick={() => {
                                resetForm()
                                setIsDialogOpen(true)
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Create Your First Budget
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {budgets.map((budget) => {
                        const spent = budget.spent || 0
                        const percentage = Math.min((spent / budget.amount) * 100, 100)
                        const isOverBudget = spent > budget.amount

                        return (
                            <Card key={budget.id} className="relative overflow-hidden">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">
                                            {budget.category?.name || 'Unknown Category'}
                                        </CardTitle>
                                        <Badge variant={isOverBudget ? 'destructive' : 'secondary'}>
                                            {budget.period}
                                        </Badge>
                                    </div>
                                    <CardDescription>
                                        {formatCurrency(spent)} of {formatCurrency(budget.amount)}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Progress</span>
                                            <span className={isOverBudget ? 'text-red-500' : ''}>
                                                {percentage.toFixed(0)}%
                                            </span>
                                        </div>
                                        <Progress
                                            value={percentage}
                                            className="h-2"
                                            style={{ '--progress-color': getProgressColor(spent, budget.amount) } as React.CSSProperties}
                                        />
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Remaining</span>
                                        <span
                                            className={cn(
                                                'font-medium',
                                                isOverBudget ? 'text-red-500' : 'text-green-500'
                                            )}
                                        >
                                            {isOverBudget ? '-' : ''}
                                            {formatCurrency(Math.abs(budget.amount - spent))}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => {
                                                setEditingBudget(budget)
                                                setFormData({
                                                    category_id: budget.category_id,
                                                    amount: budget.amount.toString(),
                                                    period: budget.period,
                                                })
                                                setIsDialogOpen(true)
                                            }}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(budget.id)}
                                        >
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
                            {editingBudget ? 'Edit Budget' : 'Create Budget'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingBudget
                                ? 'Update your budget settings.'
                                : 'Set a spending limit for a category.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                                value={formData.category_id}
                                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem key={category.id} value={category.id}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount">Budget Amount</Label>
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
                            <Label>Period</Label>
                            <Select
                                value={formData.period}
                                onValueChange={(value: 'weekly' | 'monthly' | 'yearly') =>
                                    setFormData({ ...formData, period: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editingBudget ? 'Update' : 'Create'} Budget
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
