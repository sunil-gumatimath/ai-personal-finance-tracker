import { useState, useEffect, useCallback } from 'react'
import { Plus, Tag, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import type { Category } from '@/types'

const COLORS = [
    '#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

const ICONS = [
    'shopping-cart', 'home', 'car', 'utensils', 'plane',
    'gift', 'heart', 'briefcase', 'gamepad', 'music',
]

export function Categories() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [categories, setCategories] = useState<Category[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        type: 'expense' as 'income' | 'expense',
        color: COLORS[0],
        icon: ICONS[0],
    })

    const fetchCategories = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            const res = await api.categories.list()
            setCategories((res.categories || []) as Category[])
        } catch (error) {
            console.error('Error fetching categories:', error)
            toast.error('Failed to load categories')
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        try {
            const categoryData = {
                name: formData.name,
                type: formData.type,
                color: formData.color,
                icon: formData.icon,
            }

            if (editingCategory) {
                await api.categories.update(editingCategory.id, categoryData)
                toast.success('Category updated successfully')
            } else {
                await api.categories.create(categoryData)
                toast.success('Category created successfully')
            }

            setIsDialogOpen(false)
            resetForm()
            fetchCategories()
        } catch (error) {
            console.error('Error saving category:', error)
            toast.error('Failed to save category')
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await api.categories.delete(id)
            toast.success('Category deleted')
            fetchCategories()
        } catch (error) {
            console.error('Error deleting category:', error)
            toast.error('Failed to delete category. It may be in use by transactions.')
        }
    }

    const resetForm = () => {
        setEditingCategory(null)
        setFormData({
            name: '',
            type: 'expense',
            color: COLORS[0],
            icon: ICONS[0],
        })
    }

    const incomeCategories = categories.filter((c) => c.type === 'income')
    const expenseCategories = categories.filter((c) => c.type === 'expense')

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
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Categories</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Organize your income and expenses by categories
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
                    Add Category
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Income Categories */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center gap-2 mb-4">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <h3 className="text-base font-semibold">Income Categories</h3>
                    </div>
                    <div className="relative">
                        {incomeCategories.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                No income categories yet
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {incomeCategories.map((category) => (
                                    <div
                                        key={category.id}
                                        className="flex items-center justify-between rounded-xl border border-border/30 bg-background/30 p-3 transition-all duration-200 hover:bg-background/50 hover:border-border/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-xl"
                                                style={{ backgroundColor: `${category.color}20` }}
                                            >
                                                <Tag className="h-5 w-5" style={{ color: category.color }} />
                                            </div>
                                            <span className="font-medium">{category.name}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => {
                                                    setEditingCategory(category)
                                                    setFormData({
                                                        name: category.name,
                                                        type: category.type,
                                                        color: category.color,
                                                        icon: category.icon,
                                                    })
                                                    setIsDialogOpen(true)
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(category.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>

                {/* Expense Categories */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center gap-2 mb-4">
                        <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                            <TrendingDown className="h-4 w-4" />
                        </div>
                        <h3 className="text-base font-semibold">Expense Categories</h3>
                    </div>
                    <div className="relative">
                        {expenseCategories.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                No expense categories yet
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {expenseCategories.map((category) => (
                                    <div
                                        key={category.id}
                                        className="flex items-center justify-between rounded-xl border border-border/30 bg-background/30 p-3 transition-all duration-200 hover:bg-background/50 hover:border-border/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-xl"
                                                style={{ backgroundColor: `${category.color}20` }}
                                            >
                                                <Tag className="h-5 w-5" style={{ color: category.color }} />
                                            </div>
                                            <span className="font-medium">{category.name}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => {
                                                    setEditingCategory(category)
                                                    setFormData({
                                                        name: category.name,
                                                        type: category.type,
                                                        color: category.color,
                                                        icon: category.icon,
                                                    })
                                                    setIsDialogOpen(true)
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(category.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-rose-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingCategory ? 'Edit Category' : 'Add Category'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingCategory
                                ? 'Update the category details.'
                                : 'Create a new category for organizing transactions.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                placeholder="Category name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value: 'income' | 'expense') =>
                                    setFormData({ ...formData, type: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="income">Income</SelectItem>
                                    <SelectItem value="expense">Expense</SelectItem>
                                </SelectContent>
                            </Select>
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

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editingCategory ? 'Update' : 'Create'} Category
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
