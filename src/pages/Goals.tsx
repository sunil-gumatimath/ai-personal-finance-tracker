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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
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
    const [goals, setGoals] = useState<Goal[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isContributeDialogOpen, setIsContributeDialogOpen] = useState(false)
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
    const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
    const [contributeAmount, setContributeAmount] = useState('')
    const [formData, setFormData] = useState({
        name: '',
        target_amount: '',
        current_amount: '0',
        deadline: '',
        color: '#22c55e',
        icon: 'target',
    })

    const fetchGoals = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            const res = await api.goals.list()
            setGoals((res.goals || []) as Goal[])
        } catch (error) {
            console.error('Error fetching goals:', error)
            toast.error('Failed to load goals')
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchGoals()
    }, [fetchGoals])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

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
        }
    }

    const handleContribute = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedGoal) return

        try {
            const contributionAmount = parseFloat(contributeAmount)
            const remaining = selectedGoal.target_amount - selectedGoal.current_amount

            // Cap contribution at the remaining amount to prevent exceeding target
            const actualContribution = Math.min(contributionAmount, remaining)
            const newAmount = selectedGoal.current_amount + actualContribution

            await api.goals.update(selectedGoal.id, { current_amount: newAmount })

            const isCompleted = newAmount >= selectedGoal.target_amount

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
            current_amount: goal.current_amount.toString(),
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
            current_amount: '0',
            deadline: '',
            color: '#22c55e',
            icon: 'target',
        })
    }

    const getProgress = (goal: Goal) => {
        return Math.min((goal.current_amount / goal.target_amount) * 100, 100)
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
    const completedGoals = goals.filter((g) => g.current_amount >= g.target_amount).length
    const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0)
    const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0)

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
                            <span>{totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%</span>
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
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-muted p-4">
                            <Target className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold">No goals yet</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Start by creating your first financial goal
                        </p>
                        <Button
                            className="mt-4"
                            onClick={() => {
                                resetForm()
                                setIsDialogOpen(true)
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Create Goal
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {goals.map((goal) => {
                        const GoalIcon = getGoalIcon(goal.icon)
                        const progress = getProgress(goal)
                        const isCompleted = progress >= 100
                        const daysRemaining = getDaysRemaining(goal.deadline)

                        return (
                            <Card
                                key={goal.id}
                                className={cn(
                                    'relative overflow-hidden transition-all hover:shadow-lg',
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
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="rounded-full p-2.5"
                                                style={{ backgroundColor: `${goal.color}20` }}
                                            >
                                                <GoalIcon
                                                    className="h-5 w-5"
                                                    style={{ color: goal.color }}
                                                />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">{goal.name}</CardTitle>
                                                {goal.deadline && (
                                                    <CardDescription className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {daysRemaining !== null && daysRemaining >= 0
                                                            ? `${daysRemaining} days left`
                                                            : daysRemaining !== null && daysRemaining < 0
                                                                ? 'Overdue'
                                                                : format(new Date(goal.deadline), 'MMM d, yyyy')}
                                                    </CardDescription>
                                                )}
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
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
                                                    onClick={() => handleDelete(goal.id)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
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
                                                {formatCurrency(goal.current_amount)}
                                            </span>
                                            <span className="text-muted-foreground">
                                                of {formatCurrency(goal.target_amount)}
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
                                </CardContent>
                            </Card>
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
                            <Button type="submit">
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
                                step="0.01"
                                placeholder="100"
                                value={contributeAmount}
                                onChange={(e) => setContributeAmount(e.target.value)}
                                required
                                autoFocus
                            />
                            {selectedGoal && (
                                <p className="text-xs text-muted-foreground">
                                    Remaining: {formatCurrency(selectedGoal.target_amount - selectedGoal.current_amount)}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsContributeDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Add Money</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
