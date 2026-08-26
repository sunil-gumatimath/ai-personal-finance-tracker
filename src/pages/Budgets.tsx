import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/system/ErrorState'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { ApiError } from '@/lib/errors'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { toNumber } from '@/lib/number'
import { cn } from '@/lib/utils'
import type { Budget, Category } from '@/types'

/** Monthly-equivalent multiplier so mixed-period budgets sum honestly. */
const PERIOD_TO_MONTHLY: Record<Budget['period'], number> = {
    weekly: 52 / 12,
    monthly: 1,
    yearly: 1 / 12,
}

function capitalizePeriod(period: Budget['period']): string {
    return period.charAt(0).toUpperCase() + period.slice(1)
}

/** Threshold color for progress bars and % text, using money tokens. */
function getProgressColor(spent: number, limit: number): string {
    const percentage = limit > 0 ? (spent / limit) * 100 : spent > 0 ? 101 : 0
    if (percentage >= 100) return 'var(--expense)'
    if (percentage >= 80) return 'var(--color-amber-500)'
    return 'var(--income)'
}

export function Budgets() {
    const { user } = useAuth()
    const { formatCurrency } = usePreferences()
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState(false)
    const [budgets, setBudgets] = useState<Budget[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
    const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [amountError, setAmountError] = useState<string | null>(null)
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
                api.budgets.list(),
                api.categories.list('expense'),
            ])

            setBudgets((budgetsRes.budgets || []) as Budget[])
            setCategories((categoriesRes.categories || []) as Category[])
            setFetchError(false)
        } catch (error) {
            console.error('Error fetching data:', error)
            setFetchError(true)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleRetry = useCallback(() => {
        setFetchError(false)
        setLoading(true)
        void fetchData()
    }, [fetchData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || isSaving) return

        const amount = Number.parseFloat(formData.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
            setAmountError('Enter an amount greater than 0.')
            return
        }
        if (!formData.category_id) {
            toast.error('Please select a category')
            return
        }

        setAmountError(null)
        setIsSaving(true)

        try {
            const now = new Date()
            // Format date as YYYY-MM-DD to avoid timezone issues with PostgreSQL DATE type
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const startDateStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-01`

            const budgetData = {
                category_id: formData.category_id,
                amount,
                period: formData.period,
                start_date: startDateStr,
            }

            if (editingBudget) {
                await api.budgets.update(editingBudget.id, budgetData)
                toast.success('Budget updated successfully')
            } else {
                await api.budgets.create(budgetData)
                toast.success('Budget created successfully')
            }

            resetForm()
            setIsDialogOpen(false) // keep the dialog open until the save resolves
            fetchData()
        } catch (error) {
            console.error('Error saving budget:', error)
            toast.error(
                error instanceof ApiError && error.message
                    ? error.message
                    : 'Failed to save budget',
            )
        } finally {
            setIsSaving(false)
        }
    }

    /** Confirm-and-execute delete; the alert dialog stays open until it resolves. */
    const handleDelete = async () => {
        if (!budgetToDelete) return
        setIsDeleting(true)
        try {
            await api.budgets.delete(budgetToDelete.id)
            toast.success('Budget deleted')
            fetchData()
        } catch (error) {
            console.error('Error deleting budget:', error)
            toast.error(
                error instanceof ApiError && error.message
                    ? error.message
                    : 'Failed to delete budget',
            )
        } finally {
            setIsDeleting(false)
            setBudgetToDelete(null)
        }
    }

    const resetForm = () => {
        setEditingBudget(null)
        setAmountError(null)
        setFormData({
            category_id: '',
            amount: '',
            period: 'monthly',
        })
    }

    if (loading) {
        return <BudgetsSkeleton />
    }

    if (fetchError) {
        return (
            <div className="py-8">
                <ErrorState
                    title="Couldn't load budgets"
                    message="We couldn't load your budgets and categories. Check your connection and try again."
                    onRetry={handleRetry}
                />
            </div>
        )
    }

    // Mixed periods can't be summed raw — normalize each to its monthly
    // equivalent first (weekly ×52/12, yearly ÷12), then aggregate.
    const totalBudget = budgets.reduce(
        (sum, b) => sum + toNumber(b.amount) * PERIOD_TO_MONTHLY[b.period],
        0,
    )
    const totalSpent = budgets.reduce(
        (sum, b) => sum + toNumber(b.spent) * PERIOD_TO_MONTHLY[b.period],
        0,
    )
    const periodCounts = budgets.reduce<Record<string, number>>((acc, b) => {
        acc[b.period] = (acc[b.period] ?? 0) + 1
        return acc
    }, {})
    const totalPct =
        totalBudget > 0 ? (totalSpent / totalBudget) * 100 : totalSpent > 0 ? 101 : 0

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
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-[border-color,background-color] duration-200 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Budget</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-primary">
                            <Target className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                            {formatCurrency(totalBudget)}
                        </span>
                    </div>
                    {/* Per-period chips make the normalization visible */}
                    {budgets.length > 0 && (
                        <div className="relative mb-2 flex flex-wrap gap-1.5">
                            {(Object.keys(periodCounts) as Array<Budget['period']>).map((period) => (
                                <span
                                    key={period}
                                    className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                                >
                                    {periodCounts[period]} {capitalizePeriod(period)}
                                </span>
                            ))}
                        </div>
                    )}
                    <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <span>Normalized monthly total</span>
                    </p>
                    <p className="text-xs text-muted-foreground/70">Weekly ×52/12 · yearly ÷12</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-[border-color,background-color] duration-200 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Spent</span>
                        <div
                            className={cn(
                                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                totalPct >= 100
                                    ? "bg-[var(--expense)]/10 text-[var(--expense)]"
                                    : totalPct >= 80
                                        ? "bg-amber-500/10 text-amber-500"
                                        : "bg-[var(--income)]/10 text-[var(--income)]",
                            )}
                        >
                            <span>{Math.round(totalPct)}%</span>
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                            {formatCurrency(totalSpent)}
                        </span>
                    </div>
                    <div
                        className={cn(
                            "flex items-center gap-1.5 text-sm font-medium",
                            totalPct >= 100
                                ? "text-[var(--expense)]"
                                : totalPct >= 80
                                    ? "text-amber-500"
                                    : "text-[var(--income)]",
                        )}
                    >
                        <span>
                            {totalBudget > 0
                                ? `${Math.round(totalPct)}% of normalized limit`
                                : 'No budgets set'}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">Spent this period</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[var(--expense)] opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-[border-color,background-color] duration-200 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    {(() => {
                        const remaining = totalBudget - totalSpent
                        const isOver = remaining < 0
                        return (
                            <>
                                <div className="relative flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-muted-foreground">Remaining</span>
                                    <div
                                        className={cn(
                                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                            isOver
                                                ? "bg-[var(--expense)]/10 text-[var(--expense)]"
                                                : "bg-[var(--income)]/10 text-[var(--income)]",
                                        )}
                                    >
                                        <span>
                                            {totalBudget > 0
                                                ? `${isOver ? '' : '+'}${Math.round((remaining / totalBudget) * 100)}%`
                                                : '0%'}
                                        </span>
                                    </div>
                                </div>
                                <div className="relative mb-3">
                                    <span
                                        className={cn(
                                            "text-2xl font-bold tracking-tight tabular-nums",
                                            isOver
                                                ? "text-[var(--expense)]"
                                                : "text-[var(--income)]",
                                        )}
                                    >
                                        {isOver ? '-' : '+'}
                                        {formatCurrency(Math.abs(remaining))}
                                    </span>
                                </div>
                                <div
                                    className={cn(
                                        "flex items-center gap-1.5 text-sm font-medium",
                                        isOver
                                            ? "text-[var(--expense)]"
                                            : "text-[var(--income)]",
                                    )}
                                >
                                    <span>{isOver ? 'Over budget' : 'Under budget'}</span>
                                </div>
                                <p className="text-xs text-muted-foreground/70">Available to spend</p>
                                <div
                                    className={cn(
                                        "absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20",
                                        isOver ? "bg-[var(--expense)]" : "bg-[var(--income)]",
                                    )}
                                />
                            </>
                        )
                    })()}
                </div>
            </div>

            {/* Budget Cards */}
            {budgets.length === 0 ? (
                <div className="group relative overflow-hidden rounded-xl border-2 border-dashed border-border/50 bg-card/50 backdrop-blur-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex flex-col items-center justify-center py-16 text-center">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-150" />
                            <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-background/50 text-primary border border-border/50">
                                <Target className="h-8 w-8" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold tracking-tight mb-2">No budgets yet</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-8">
                            Create budgets to set spending limits for different categories and track your progress
                        </p>
                        <Button
                            onClick={() => {
                                resetForm()
                                setIsDialogOpen(true)
                            }}
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Create Your First Budget
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {budgets.map((budget) => {
                        // DECIMAL fields may arrive as strings — normalize once
                        const spent = toNumber(budget.spent)
                        const limit = toNumber(budget.amount)
                        // TRUE percentage — never clamped for display.
                        const rawPercentage =
                            limit > 0 ? (spent / limit) * 100 : spent > 0 ? 101 : 0
                        // The bar itself still caps at 100 so the indicator stays put.
                        const barPercentage = Math.min(Math.max(rawPercentage, 0), 100)
                        const isOverBudget = spent > limit
                        const isApproaching = !isOverBudget && rawPercentage >= 80
                        const progressColor = getProgressColor(spent, limit)

                        return (
                            <div key={budget.id} className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-[border-color,background-color] duration-200 hover:border-border hover:bg-card/80">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                                <div className="relative space-y-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="flex min-w-0 items-center gap-2 text-base font-bold tracking-tight">
                                            {budget.category?.color && (
                                                <span
                                                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                                                    style={{ backgroundColor: budget.category.color }}
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <span className="truncate">
                                                {budget.category?.name || 'Unknown Category'}
                                            </span>
                                        </h3>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                            {isApproaching && (
                                                <Badge
                                                    variant="outline"
                                                    className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                >
                                                    Approaching
                                                </Badge>
                                            )}
                                            <Badge variant={isOverBudget ? 'destructive' : 'secondary'}>
                                                {capitalizePeriod(budget.period)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground tabular-nums">
                                        {formatCurrency(spent)} of {formatCurrency(limit)}
                                    </p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Progress</span>
                                            <span
                                                className="font-medium tabular-nums"
                                                style={{ color: progressColor }}
                                            >
                                                {Math.round(rawPercentage)}%
                                            </span>
                                        </div>
                                        <Progress
                                            value={barPercentage}
                                            className="h-2"
                                            style={{ '--progress-color': progressColor } as React.CSSProperties}
                                        />
                                        {isOverBudget && (
                                            <p className="text-xs font-medium text-[var(--expense)]">
                                                Over by {formatCurrency(spent - limit)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Remaining</span>
                                        <span
                                            className={cn(
                                                'font-medium tabular-nums',
                                                isOverBudget
                                                    ? 'text-[var(--expense)]'
                                                    : 'text-[var(--income)]',
                                            )}
                                        >
                                            {isOverBudget ? '-' : '+'}
                                            {formatCurrency(Math.abs(limit - spent))}
                                        </span>
                                    </div>
                                    {/* Always visible but subdued; fully opaque on
                                        hover or keyboard focus within the card */}
                                    <div className="flex gap-2 opacity-60 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => {
                                                setEditingBudget(budget)
                                                setAmountError(null)
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
                                            onClick={() => setBudgetToDelete(budget)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    if (!isSaving) setIsDialogOpen(open)
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[425px]">
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
                            <Label htmlFor="budget-category">Category</Label>
                            <Select
                                value={formData.category_id}
                                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                                required
                            >
                                <SelectTrigger id="budget-category">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem key={category.id} value={category.id}>
                                            <span className="flex items-center gap-2">
                                                {category.color && (
                                                    <span
                                                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                                                        style={{ backgroundColor: category.color }}
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                {category.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="budget-amount">Budget Amount</Label>
                            <Input
                                id="budget-amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => {
                                    setFormData({ ...formData, amount: e.target.value })
                                    if (amountError) setAmountError(null)
                                }}
                                required
                                aria-invalid={Boolean(amountError) || undefined}
                                aria-describedby={amountError ? 'budget-amount-error' : undefined}
                            />
                            {amountError && (
                                <p id="budget-amount-error" role="alert" className="text-xs text-destructive">
                                    {amountError}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="budget-period">Period</Label>
                            <Select
                                value={formData.period}
                                onValueChange={(value: 'weekly' | 'monthly' | 'yearly') =>
                                    setFormData({ ...formData, period: value })
                                }
                            >
                                <SelectTrigger id="budget-period">
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
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && (
                                    <Loader2
                                        className="mr-2 h-4 w-4 motion-safe:animate-spin"
                                        aria-hidden="true"
                                    />
                                )}
                                {editingBudget ? 'Update' : 'Create'} Budget
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog
                open={budgetToDelete !== null}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) setBudgetToDelete(null)
                }}
            >
                <AlertDialogContent className="sm:max-w-[425px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">
                            Delete Budget
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Delete the budget for{" "}
                            <strong>"{budgetToDelete?.category?.name || 'Unknown Category'}"</strong>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-2">
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                            onClick={(e) => {
                                // Radix auto-closes on click; keep the dialog mounted so
                                // the pending state is actually visible until deletion resolves.
                                e.preventDefault()
                                void handleDelete()
                            }}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2
                                        className="mr-2 h-4 w-4 motion-safe:animate-spin"
                                        aria-hidden="true"
                                    />
                                    Deleting…
                                </>
                            ) : (
                                'Delete Budget'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

/** Loading skeleton shaped like the loaded page layout. */
function BudgetsSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-9 w-full rounded-md sm:w-36" />
            </div>

            {/* Overview cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-44 rounded-xl" />
                ))}
            </div>

            {/* Budget cards grid */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-64 rounded-xl" />
                ))}
            </div>
        </div>
    )
}
