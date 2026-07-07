import { useState, useEffect, useCallback } from 'react'
import {
    Plus,
    Tag,
    Pencil,
    Trash2,
    TrendingUp,
    TrendingDown,
    ShoppingCart,
    Home,
    Car,
    Utensils,
    Plane,
    Gift,
    Heart,
    Briefcase,
    Gamepad,
    Music,
    GraduationCap,
    Zap,
    DollarSign,
} from 'lucide-react'
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
import { api } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import type { Category } from '@/types'

const COLORS = [
    '#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

const ICONS = [
    'shopping-cart',
    'home',
    'car',
    'utensils',
    'plane',
    'gift',
    'heart',
    'briefcase',
    'gamepad',
    'music',
    'graduation-cap',
    'zap',
    'trending-up',
    'dollar-sign',
]

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    'shopping-cart': ShoppingCart,
    'home': Home,
    'car': Car,
    'utensils': Utensils,
    'plane': Plane,
    'gift': Gift,
    'heart': Heart,
    'briefcase': Briefcase,
    'gamepad': Gamepad,
    'music': Music,
    'graduation-cap': GraduationCap,
    'zap': Zap,
    'trending-up': TrendingUp,
    'dollar-sign': DollarSign,
}

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
                    className="w-full sm:w-auto cursor-pointer"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Category
                </Button>
            </div>

            {/* Metrics Overview */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                {/* Total Categories Card */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-md p-5 transition-all duration-300 hover:border-primary/20 hover:bg-card/75 hover:shadow-[0_8px_30px_rgba(255,255,255,0.02)]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Categories</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Tag className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <span className="text-2xl font-bold tracking-tight text-foreground">
                            {categories.length}
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Defined system taxonomies</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary opacity-5 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-10 pointer-events-none" />
                </div>

                {/* Income Categories Card */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-md p-5 transition-all duration-300 hover:border-emerald-500/20 hover:bg-card/75 hover:shadow-[0_8px_30px_rgba(16,185,129,0.04)]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Income Categories</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <span className="text-2xl font-bold tracking-tight text-foreground">
                            {incomeCategories.length}
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Inflow classifications</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-500 opacity-5 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-10 pointer-events-none" />
                </div>

                {/* Expense Categories Card */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-md p-5 transition-all duration-300 hover:border-rose-500/20 hover:bg-card/75 hover:shadow-[0_8px_30px_rgba(244,63,94,0.04)]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Expense Categories</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                            <TrendingDown className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <span className="text-2xl font-bold tracking-tight text-foreground">
                            {expenseCategories.length}
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Outflow classifications</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-rose-500 opacity-5 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-10 pointer-events-none" />
                </div>
            </div>

            {/* Income & Expense Splitting Column Panel */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Income Categories Column */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border/80 hover:bg-card/60">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center gap-2 mb-6">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <h3 className="text-base font-bold tracking-tight">Income Categories</h3>
                    </div>
                    <div className="relative">
                        {incomeCategories.length === 0 ? (
                            <div className="py-12 text-center text-sm text-muted-foreground border-2 border-dashed border-border/40 rounded-xl bg-background/25">
                                No income categories defined yet
                            </div>
                        ) : (
                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                {incomeCategories.map((category) => {
                                    const IconComponent = iconMap[category.icon] || Tag
                                    return (
                                        <div
                                            key={category.id}
                                            className="group/tile relative overflow-hidden rounded-xl border bg-background/25 backdrop-blur-sm p-3.5 flex items-center justify-between transition-all duration-300 hover:bg-background/40 hover:-translate-y-0.5"
                                            style={{ borderColor: `${category.color}30` }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.boxShadow = `0 10px 30px -10px ${category.color}15, 0 1px 3px 0 ${category.color}05`
                                                e.currentTarget.style.borderColor = `${category.color}60`
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.boxShadow = 'none'
                                                e.currentTarget.style.borderColor = `${category.color}30`
                                            }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-transform duration-300 group-hover/tile:scale-105"
                                                    style={{ backgroundColor: `${category.color}15` }}
                                                >
                                                    <IconComponent className="h-4.5 w-4.5" style={{ color: category.color }} />
                                                </div>
                                                <span className="font-bold text-sm text-foreground truncate tracking-tight">{category.name}</span>
                                            </div>
                                            <div className="flex gap-0.5 opacity-60 group-hover/tile:opacity-100 transition-opacity duration-200 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background/80 cursor-pointer"
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
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-background/80 cursor-pointer"
                                                    onClick={() => handleDelete(category.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500 opacity-5 blur-3xl transition-opacity group-hover:opacity-10 pointer-events-none" />
                </div>

                {/* Expense Categories Column */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border/80 hover:bg-card/60">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center gap-2 mb-6">
                        <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                            <TrendingDown className="h-4 w-4" />
                        </div>
                        <h3 className="text-base font-bold tracking-tight">Expense Categories</h3>
                    </div>
                    <div className="relative">
                        {expenseCategories.length === 0 ? (
                            <div className="py-12 text-center text-sm text-muted-foreground border-2 border-dashed border-border/40 rounded-xl bg-background/25">
                                No expense categories defined yet
                            </div>
                        ) : (
                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                {expenseCategories.map((category) => {
                                    const IconComponent = iconMap[category.icon] || Tag
                                    return (
                                        <div
                                            key={category.id}
                                            className="group/tile relative overflow-hidden rounded-xl border bg-background/25 backdrop-blur-sm p-3.5 flex items-center justify-between transition-all duration-300 hover:bg-background/40 hover:-translate-y-0.5"
                                            style={{ borderColor: `${category.color}30` }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.boxShadow = `0 10px 30px -10px ${category.color}15, 0 1px 3px 0 ${category.color}05`
                                                e.currentTarget.style.borderColor = `${category.color}60`
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.boxShadow = 'none'
                                                e.currentTarget.style.borderColor = `${category.color}30`
                                            }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-transform duration-300 group-hover/tile:scale-105"
                                                    style={{ backgroundColor: `${category.color}15` }}
                                                >
                                                    <IconComponent className="h-4.5 w-4.5" style={{ color: category.color }} />
                                                </div>
                                                <span className="font-bold text-sm text-foreground truncate tracking-tight">{category.name}</span>
                                            </div>
                                            <div className="flex gap-0.5 opacity-60 group-hover/tile:opacity-100 transition-opacity duration-200 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background/80 cursor-pointer"
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
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-background/80 cursor-pointer"
                                                    onClick={() => handleDelete(category.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-rose-500 opacity-5 blur-3xl transition-opacity group-hover:opacity-10 pointer-events-none" />
                </div>
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold tracking-tight">
                            {editingCategory ? 'Edit Category' : 'Add Category'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingCategory
                                ? 'Update the category details.'
                                : 'Create a new category for organizing transactions.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Live Preview block */}
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Live Preview</Label>
                            <div 
                                className="flex items-center gap-3 rounded-xl border p-4 bg-muted/20 backdrop-blur-sm transition-all"
                                style={{ 
                                    borderColor: `${formData.color}40`,
                                    boxShadow: `0 8px 30px -10px ${formData.color}20`
                                }}
                            >
                                <div
                                    className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                                    style={{ backgroundColor: `${formData.color}15` }}
                                >
                                    {(() => {
                                        const PreviewIcon = iconMap[formData.icon] || Tag
                                        return <PreviewIcon className="h-5 w-5" style={{ color: formData.color }} />
                                    })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="font-bold text-sm text-foreground truncate block">
                                        {formData.name || 'Category Name'}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                                        {formData.type}
                                    </span>
                                </div>
                            </div>
                        </div>

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
                            <Label>Color Palette</Label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={cn(
                                            'h-8 w-8 rounded-full transition-all duration-200 hover:scale-115 cursor-pointer',
                                            formData.color === color && 'ring-2 ring-offset-2 ring-offset-background'
                                        )}
                                        style={{ 
                                            backgroundColor: color,
                                            boxShadow: formData.color === color ? `0 0 12px ${color}` : undefined,
                                            border: formData.color === color ? '2px solid white' : undefined
                                        }}
                                        onClick={() => setFormData({ ...formData, color })}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Category Icon</Label>
                            <div className="grid grid-cols-5 gap-2 max-h-[140px] overflow-y-auto p-1 border border-border/30 rounded-xl bg-background/20">
                                {ICONS.map((iconName) => {
                                    const IconOption = iconMap[iconName] || Tag
                                    const isSelected = formData.icon === iconName
                                    return (
                                        <button
                                            key={iconName}
                                            type="button"
                                            className={cn(
                                                'flex h-10 items-center justify-center rounded-xl border border-border/40 bg-card/60 transition-all hover:scale-110 hover:bg-muted cursor-pointer',
                                                isSelected && 'border-transparent'
                                            )}
                                            style={isSelected ? { 
                                                backgroundColor: `${formData.color}20`,
                                                color: formData.color,
                                                boxShadow: `0 0 10px ${formData.color}25`,
                                                border: `2px solid ${formData.color}`
                                            } : undefined}
                                            onClick={() => setFormData({ ...formData, icon: iconName })}
                                        >
                                            <IconOption className="h-4 w-4" />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
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
