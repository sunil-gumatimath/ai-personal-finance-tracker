import { useState, useEffect, useCallback } from 'react'
import { format, differenceInDays } from 'date-fns'
import {
    Plus,
    Target,
    Pencil,
    Trash2,
    MoreHorizontal,
    TrendingUp,
    Calendar,
    Sparkles,
    Trophy,
    Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { ErrorState } from '@/components/system/ErrorState'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { toNumber } from '@/lib/number'
import { cn } from '@/lib/utils'
import type { Goal } from '@/types'

const goalIcons = [
    { value: 'target', label: 'Target', icon: Target },
    { value: 'trophy', label: 'Trophy', icon: Trophy },
    { value: 'sparkles', label: 'Sparkles', icon: Sparkles },
    { value: 'trending-up', label: 'Growth', icon: TrendingUp },
]

const goalColors = [
    { value: '#22c55e', label: 'Green' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#ef4444', label: 'Red' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#06b6d4', label: 'Cyan' },
]

export function Goals() {
    const { user } = useAuth()
    const { formatCurrency } = usePreferences()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [goals, setGoals] = useState<Goal[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isContributeDialogOpen, setIsContributeDialogOpen] = useState(false)
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
    const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
    const [contributeAmount, setContributeAmount] = useState('')
    const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        target_amount: '',
        // Blank (not "0") so the min="0.01" input never blocks a legit zero balance.
        current_amount: '',
        deadline: '',
        color: '#22c55e',
        icon: 'target',
    })

    const fetchGoals = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        setError(false)
        try {
            const res = await api.goals.list()
            setGoals((res.goals || []) as Goal[])
        } catch (error) {
            console.error('Error fetching goals:', error)
            // Failure must never masquerade as "no goals yet" — surface a retry state.
            setError(true)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchGoals()
    }, [fetchGoals])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || isSaving) return
        setIsSaving(true)

        try {
            const goalData = {
                name: formData.name,
                target_amount: parseFloat(formData.target_amount),
                current_amount: parseFloat(formData.current_amount) || 0,
                deadline: formData.deadline || null,
                color: formData.color,
                icon: formData.icon,
            }

            if (editingGoal) {
                await api.goals.update(editingGoal.id, goalData)
                toast.success('Goal updated successfully')
            } else {
                await api.goals.create(goalData)
                toast.success('Goal created successfully! 🎯')
            }

            setIsDialogOpen(false)
            resetForm()
            fetchGoals()
        } catch (error) {
            console.error('Error saving goal:', error)
            toast.error('Failed to save goal')
        } finally {
            setIsSaving(false)
        }
    }

    const handleContribute = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedGoal || isSaving) return

        // Reject invalid input instead of computing NaN balances.
        const contributionAmount = parseFloat(contributeAmount)
        if (!Number.isFinite(contributionAmount) || contributionAmount <= 0) {
            toast.error('Enter an amount greater than 0')
            return
        }

        const remaining =
            toNumber(selectedGoal.target_amount) -
            toNumber(selectedGoal.current_amount)

        // Nothing left to contribute — don't let a stale dialog push the goal
        // past its target.
        if (remaining <= 0) {
            toast.info('This goal is already fully funded')
            setIsContributeDialogOpen(false)
            setContributeAmount('')
            setSelectedGoal(null)
            return
        }

        setIsSaving(true)

        try {
            // Cap contribution at the remaining amount to prevent exceeding target
            const actualContribution = Math.max(
                0,
                Math.min(contributionAmount, remaining),
            )
            if (actualContribution <= 0) return

            const newAmount = toNumber(selectedGoal.current_amount) + actualContribution

            await api.goals.update(selectedGoal.id, { current_amount: newAmount })

            const isCompleted = newAmount >= toNumber(selectedGoal.target_amount)

            if (contributionAmount > remaining) {
                toast.success(
                    isCompleted
                        ? `🎉 Goal completed! Added ${formatCurrency(actualContribution)} (capped at remaining amount)`
                        : `Added ${formatCurrency(actualContribution)} to your goal!`
                )
            } else {
                toast.success(
                    isCompleted
                        ? '🎉 Congratulations! Goal completed!'
                        : `Added ${formatCurrency(actualContribution)} to your goal!`
                )
            }

            setIsContributeDialogOpen(false)
            setContributeAmount('')
            setSelectedGoal(null)
            fetchGoals()
        } catch (error) {
            console.error('Error contributing to goal:', error)
            toast.error('Failed to add contribution')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await api.goals.delete(id)
            toast.success('Goal deleted')
            fetchGoals()
        } catch (error) {
            console.error('Error deleting goal:', error)
            toast.error('Failed to delete goal')
        }
    }

    const handleEdit = (goal: Goal) => {
        setEditingGoal(goal)
        setFormData({
            name: goal.name,
            target_amount: goal.target_amount.toString(),
            current_amount: goal.current_amount ? goal.current_amount.toString() : '',
            deadline: goal.deadline || '',
            color: goal.color,
            icon: goal.icon,
        })
        setIsDialogOpen(true)
    }

    const resetForm = () => {
        setEditingGoal(null)
        setFormData({
            name: '',
            target_amount: '',
            current_amount: '',
            deadline: '',
            color: '#22c55e',
            icon: 'target',
        })
    }

    const getProgress = (goal: Goal) => {
        return Math.min(
            (toNumber(goal.current_amount) / toNumber(goal.target_amount)) * 100,
            100,
        )
    }

    const getDaysRemaining = (deadline: string | null) => {
        if (!deadline) return null
        const days = differenceInDays(new Date(deadline), new Date())
        return days
    }

    const getGoalIcon = (iconName: string) => {
        const found = goalIcons.find((i) => i.value === iconName)
        return found?.icon || Target
    }

    // Stats
    const totalGoals = goals.length
    const completedGoals = goals.filter(
        (g) => toNumber(g.current_amount) >= toNumber(g.target_amount),
    ).length
    const totalSaved = goals.reduce((sum, g) => sum + toNumber(g.current_amount), 0)
    const totalTarget = goals.reduce((sum, g) => sum + toNumber(g.target_amount), 0)

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Financial Goals</h1>
                        <p className="text-sm sm:text-base text-muted-foreground">
                            Track your savings goals and celebrate achievements
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
                        New Goal
                    </Button>
                </div>
                <ErrorState
                    title="Couldn't load your goals"
                    message="We couldn't reach your savings goals. Check your connection and try again."
                    onRetry={fetchGoals}
                />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Financial Goals</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Track your savings goals and celebrate achievements
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
                    New Goal
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Active Goals</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-primary">
                            <Target className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            {totalGoals - completedGoals}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <span>In progress</span>
                        <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs text-muted-foreground/70">Goals to achieve</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Completed</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-emerald-400">
                            <Trophy className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            {completedGoals}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                        <span>Goals achieved</span>
                        <Trophy className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs text-muted-foreground/70">Congratulations!</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Saved</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-blue-400">
                            <TrendingUp className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            {formatCurrency(totalSaved)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-blue-400">
                        <span>Saved towards goals</span>
                        <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs text-muted-foreground/70">Across all goals</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-blue-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Overall Progress</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-purple-400">
                            <Sparkles className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            {totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-purple-400">
                        <span>Towards all goals</span>
                        <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs text-muted-foreground/70">Keep it up!</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-purple-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>
            </div>

            {/* Goals Grid */}
            {goals.length === 0 ? (
                <div className="group relative overflow-hidden rounded-xl border-2 border-dashed border-border/50 bg-card/50 backdrop-blur-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex flex-col items-center justify-center py-16 text-center">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-150" />
                            <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-background/50 text-primary border border-border/50">
                                <Target className="h-8 w-8" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold tracking-tight mb-2">No goals yet</h3>
                        <p className="text-sm text-muted-foreground mb-8">
                            Start by creating your first financial goal
                        </p>
                        <Button
                            onClick={() => {
                                resetForm()
                                setIsDialogOpen(true)
                            }}
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Create Goal
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {goals.map((goal, i) => {
                        const GoalIcon = getGoalIcon(goal.icon)
                        const progress = getProgress(goal)
                        const isCompleted = progress >= 100
                        const daysRemaining = getDaysRemaining(goal.deadline)

                        return (
                            <div
                                key={goal.id}
                                style={{ animationDelay: `${i * 40}ms` }}
                                className={cn(
                                    'group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80 motion-safe:animate-fade-in-up',
                                    isCompleted && 'ring-2 ring-green-500/50'
                                )}
                            >
                                {isCompleted && (
                                    <div className="absolute right-3 top-3">
                                        <Badge className="bg-green-500 text-white">
                                            <Trophy className="mr-1 h-3 w-3" />
                                            Completed!
                                        </Badge>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                                <div className="relative space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="rounded-xl p-2.5"
                                                style={{ backgroundColor: `${goal.color}20` }}
                                            >
                                                <GoalIcon
                                                    className="h-5 w-5"
                                                    style={{ color: goal.color }}
                                                />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold tracking-tight">{goal.name}</h3>
                                                {goal.deadline && daysRemaining !== null && (
                                                    <p
                                                        className={cn(
                                                            'text-sm font-medium flex items-center gap-1',
                                                            daysRemaining < 0
                                                                ? 'text-destructive'
                                                                : daysRemaining <= 7
                                                                    ? 'text-amber-500'
                                                                    : 'text-muted-foreground',
                                                        )}
                                                    >
                                                        <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                        {daysRemaining < 0
                                                            ? `Overdue · ${format(new Date(goal.deadline), 'MMM d, yyyy')}`
                                                            : daysRemaining <= 7
                                                                ? `Due soon · ${daysRemaining === 0 ? 'today' : `${daysRemaining}d left`} · ${format(new Date(goal.deadline), 'MMM d, yyyy')}`
                                                                : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left · ${format(new Date(goal.deadline), 'MMM d, yyyy')}`}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    aria-label={`Actions for ${goal.name}`}
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(goal)}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => setGoalToDelete(goal)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Progress</span>
                                            <span className="font-medium">{Math.round(progress)}%</span>
                                        </div>
                                        <Progress
                                            value={progress}
                                            className="h-2"
                                            style={
                                                {
                                                    '--progress-color': goal.color,
                                                } as React.CSSProperties
                                            }
                                        />
                                        <div className="flex justify-between text-sm">
                                            <span className="font-semibold">
                                                {formatCurrency(toNumber(goal.current_amount))}
                                            </span>
                                            <span className="text-muted-foreground">
                                                of {formatCurrency(toNumber(goal.target_amount))}
                                            </span>
                                        </div>
                                    </div>
                                    {!isCompleted && (
                                        <Button
                                            className="w-full"
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedGoal(goal)
                                                setIsContributeDialogOpen(true)
                                            }}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Money
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add/Edit Goal Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingGoal ? 'Edit Goal' : 'Create New Goal'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingGoal
                                ? 'Update your financial goal details.'
                                : 'Set a new savings target to work towards.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Goal Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Emergency Fund, Vacation"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="target">Target Amount</Label>
                                <Input
                                    id="target"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="10000"
                                    value={formData.target_amount}
                                    onChange={(e) =>
                                        setFormData({ ...formData, target_amount: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="current">Current Amount</Label>
                                <Input
                                    id="current"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="0"
                                    value={formData.current_amount}
                                    onChange={(e) =>
                                        setFormData({ ...formData, current_amount: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="deadline">Target Date (Optional)</Label>
                            <Input
                                id="deadline"
                                type="date"
                                value={formData.deadline}
                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                            />
                            {formData.deadline &&
                             differenceInDays(new Date(formData.deadline), new Date()) < 0 && (
                                <p className="text-xs font-medium text-amber-500">
                                    This date is in the past — the goal will show as overdue.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Icon</Label>
                                <Select
                                    value={formData.icon}
                                    onValueChange={(value) => setFormData({ ...formData, icon: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {goalIcons.map((icon) => (
                                            <SelectItem key={icon.value} value={icon.value}>
                                                <div className="flex items-center gap-2">
                                                    <icon.icon className="h-4 w-4" />
                                                    {icon.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <Select
                                    value={formData.color}
                                    onValueChange={(value) => setFormData({ ...formData, color: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {goalColors.map((color) => (
                                            <SelectItem key={color.value} value={color.value}>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-4 w-4 rounded-full"
                                                        style={{ backgroundColor: color.value }}
                                                    />
                                                    {color.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                                {editingGoal ? 'Update Goal' : 'Create Goal'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Contribute Dialog */}
            <Dialog open={isContributeDialogOpen} onOpenChange={setIsContributeDialogOpen}>
                <DialogContent className="sm:max-w-[350px]">
                    <DialogHeader>
                        <DialogTitle>Add to {selectedGoal?.name}</DialogTitle>
                        <DialogDescription>
                            How much would you like to contribute?
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleContribute} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="contribute-amount">Amount</Label>
                            <Input
                                id="contribute-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                placeholder="100"
                                value={contributeAmount}
                                onChange={(e) => setContributeAmount(e.target.value)}
                                required
                                autoFocus
                            />
                            {selectedGoal && (
                                <p className="text-xs text-muted-foreground">
                                    Remaining: {formatCurrency(toNumber(selectedGoal.target_amount) - toNumber(selectedGoal.current_amount))}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsContributeDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                                Add Money
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog
                open={goalToDelete !== null}
                onOpenChange={(open) => {
                    if (!open) setGoalToDelete(null)
                }}
            >
                <AlertDialogContent className="sm:max-w-[425px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">
                            Delete Goal
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Delete the goal{" "}
                            <strong>"{goalToDelete?.name}"</strong>? This action cannot
                            be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-2">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                            onClick={(e) => {
                                // preventDefault keeps the dialog open until the
                                // async delete resolves, then we close manually.
                                e.preventDefault()
                                if (!goalToDelete || isDeleting) return
                                setIsDeleting(true)
                                handleDelete(goalToDelete.id).finally(() => {
                                    setIsDeleting(false)
                                    setGoalToDelete(null)
                                })
                            }}
                        >
                            {isDeleting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            )}
                            Delete Goal
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
