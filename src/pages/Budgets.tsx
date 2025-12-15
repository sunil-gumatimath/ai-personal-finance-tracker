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
            const [budgetsRes, categoriesRes] = await Promise.all([
                supabase
                    .from('budgets')
                    .select(`*, category:categories(*)`)
                    .eq('user_id', user.id),
                supabase.from('categories').select('*').eq('user_id', user.id).eq('type', 'expense'),
            ])

            if (budgetsRes.data) {
                // Calculate spent amount for each budget
                const budgetsWithSpent = await Promise.all(
                    budgetsRes.data.map(async (budget) => {
                        const now = new Date()
                        let startDate: Date

                        switch (budget.period) {
                            case 'weekly':
                                startDate = new Date(now.setDate(now.getDate() - now.getDay()))
                                break
                            case 'yearly':
                                startDate = new Date(now.getFullYear(), 0, 1)
                                break
                            default: // monthly
                                startDate = new Date(now.getFullYear(), now.getMonth(), 1)
                        }

                        const { data: transactions } = await supabase
                            .from('transactions')
                            .select('amount')
                            .eq('user_id', user.id)
                            .eq('category_id', budget.category_id)
                            .eq('type', 'expense')
                            .gte('date', startDate.toISOString())

                        const spent = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0
                        return { ...budget, spent }
                    })
                )

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

    // formatCurrency is now provided by usePreferences hook

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
                    <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
                    <p className="text-muted-foreground">
                        Set spending limits and track your progress
                    </p>
                </div>
                <Button
                    onClick={() => {
                        resetForm()
                        setIsDialogOpen(true)
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Budget
                </Button>
            </div>

            {/* Overview Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Budget
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
                        <p className="text-xs text-muted-foreground">This month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Spent
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
                        <p className="text-xs text-muted-foreground">
                            {totalBudget > 0
                                ? `${((totalSpent / totalBudget) * 100).toFixed(0)}% of budget`
                                : 'No budgets set'}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Remaining
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            className={cn(
                                'text-2xl font-bold',
                                totalBudget - totalSpent >= 0 ? 'text-green-500' : 'text-red-500'
                            )}
                        >
                            {formatCurrency(totalBudget - totalSpent)}
                        </div>
                        <p className="text-xs text-muted-foreground">Available to spend</p>
                    </CardContent>
                </Card>
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
