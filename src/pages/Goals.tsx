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
import { supabase } from '@/lib/supabase'
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
            const { data, error } = await supabase
                .from('goals')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setGoals(data || [])
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
                user_id: user.id,
                name: formData.name,
                target_amount: parseFloat(formData.target_amount),
                current_amount: parseFloat(formData.current_amount) || 0,
                deadline: formData.deadline || null,
                color: formData.color,
                icon: formData.icon,
            }

            if (editingGoal) {
                const { error } = await supabase
                    .from('goals')
                    .update(goalData)
                    .eq('id', editingGoal.id)

                if (error) throw error
                toast.success('Goal updated successfully')
            } else {
                const { error } = await supabase.from('goals').insert(goalData)
                if (error) throw error
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
            const newAmount = selectedGoal.current_amount + parseFloat(contributeAmount)
            const { error } = await supabase
                .from('goals')
                .update({ current_amount: newAmount })
                .eq('id', selectedGoal.id)

            if (error) throw error

            const isCompleted = newAmount >= selectedGoal.target_amount
            toast.success(
                isCompleted
                    ? '🎉 Congratulations! Goal completed!'
                    : `Added ${formatCurrency(parseFloat(contributeAmount))} to your goal!`
            )

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
            const { error } = await supabase.from('goals').delete().eq('id', id)
            if (error) throw error
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
                    <h1 className="text-3xl font-bold tracking-tight">Financial Goals</h1>
                    <p className="text-muted-foreground">
                        Track your savings goals and celebrate achievements
                    </p>
                </div>
                <Button
                    onClick={() => {
                        resetForm()
                        setIsDialogOpen(true)
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    New Goal
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-primary/10 p-3">
                                <Target className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Active Goals</p>
                                <p className="text-2xl font-bold">{totalGoals - completedGoals}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-green-500/10 p-3">
                                <Trophy className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Completed</p>
                                <p className="text-2xl font-bold">{completedGoals}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-blue-500/10 p-3">
                                <TrendingUp className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Saved</p>
                                <p className="text-2xl font-bold">{formatCurrency(totalSaved)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-purple-500/10 p-3">
                                <Sparkles className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Overall Progress</p>
                                <p className="text-2xl font-bold">
                                    {totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
