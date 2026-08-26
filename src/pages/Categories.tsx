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
    Loader2,
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
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/system/ErrorState'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { ApiError } from '@/lib/errors'
import { useAuth } from '@/contexts/AuthContext'
import { SWATCHES, SWATCH_HEXES } from '@/lib/palette'
import { cn } from '@/lib/utils'
import type { Category } from '@/types'

const DEFAULT_COLOR = SWATCH_HEXES[0] ?? '#3b82f6'

/** Icon picker options — value matches the stored icon slug. */
const ICON_OPTIONS: ReadonlyArray<{ value: string; name: string }> = [
    { value: 'shopping-cart', name: 'Shopping cart' },
    { value: 'home', name: 'Home' },
    { value: 'car', name: 'Car' },
    { value: 'utensils', name: 'Utensils' },
    { value: 'plane', name: 'Plane' },
    { value: 'gift', name: 'Gift' },
    { value: 'heart', name: 'Heart' },
    { value: 'briefcase', name: 'Briefcase' },
    { value: 'gamepad', name: 'Game controller' },
    { value: 'music', name: 'Music' },
    { value: 'graduation-cap', name: 'Graduation cap' },
    { value: 'zap', name: 'Lightning bolt' },
    { value: 'trending-up', name: 'Trending up' },
    { value: 'dollar-sign', name: 'Dollar sign' },
]

type IconComponent = React.ComponentType<{
    className?: string
    style?: React.CSSProperties
}>

const iconMap: Record<string, IconComponent> = {
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

type Tone = 'income' | 'expense'

const TONE_STYLES: Record<
    Tone,
    { Icon: IconComponent; chipClass: string; blobClass: string }
> = {
    income: {
        Icon: TrendingUp,
        // Money semantics go through the theme tokens.
        chipClass: 'bg-[var(--income)]/10 text-[var(--income)]',
        blobClass: 'bg-[var(--income)]',
    },
    expense: {
        Icon: TrendingDown,
        chipClass: 'bg-[var(--expense)]/10 text-[var(--expense)]',
        blobClass: 'bg-[var(--expense)]',
    },
}

export function Categories() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        type: 'expense' as Tone,
        color: DEFAULT_COLOR,
        icon: ICON_OPTIONS[0]?.value ?? 'shopping-cart',
    })

    const fetchCategories = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            const res = await api.categories.list()
            setCategories((res.categories || []) as Category[])
            setFetchError(false)
        } catch (error) {
            console.error('Error fetching categories:', error)
            setFetchError(true)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    const handleRetry = useCallback(() => {
        setFetchError(false)
        setLoading(true)
        void fetchCategories()
    }, [fetchCategories])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || isSaving) return

        setIsSaving(true)

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

            resetForm()
            setIsDialogOpen(false) // keep the dialog open until the save resolves
            fetchCategories()
        } catch (error) {
            console.error('Error saving category:', error)
            toast.error(
                error instanceof ApiError && error.message
                    ? error.message
                    : 'Failed to save category',
            )
        } finally {
            setIsSaving(false)
        }
    }

    /** Confirm-and-execute delete; the alert dialog stays open until it resolves. */
    const handleDelete = async () => {
        if (!categoryToDelete) return
        setIsDeleting(true)
        try {
            await api.categories.delete(categoryToDelete.id)
            toast.success('Category deleted')
            fetchCategories()
        } catch (error) {
            console.error('Error deleting category:', error)
            // Surface the API's own reason (usually "in use by transactions").
            toast.error(
                error instanceof ApiError && error.message
                    ? error.message
                    : 'Failed to delete category. It may be in use by transactions.',
            )
        } finally {
            setIsDeleting(false)
            setCategoryToDelete(null)
        }
    }

    const openEdit = (category: Category) => {
        setEditingCategory(category)
        setFormData({
            name: category.name,
            type: category.type,
            color: category.color,
            icon: category.icon,
        })
        setIsDialogOpen(true)
    }

    const resetForm = () => {
        setEditingCategory(null)
        setFormData({
            name: '',
            type: 'expense',
            color: DEFAULT_COLOR,
            icon: ICON_OPTIONS[0]?.value ?? 'shopping-cart',
        })
    }

    const incomeCategories = categories.filter((c) => c.type === 'income')
    const expenseCategories = categories.filter((c) => c.type === 'expense')

    if (loading) {
        return <CategoriesSkeleton />
    }

    if (fetchError) {
        return (
            <div className="py-8">
                <ErrorState
                    title="Couldn't load categories"
                    message="We couldn't load your categories. Check your connection and try again."
                    onRetry={handleRetry}
                />
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
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-md p-5 transition-[border-color,background-color,box-shadow] duration-200 hover:border-primary/20 hover:bg-card/75">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Categories</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Tag className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                            {categories.length}
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Defined system taxonomies</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary opacity-5 blur-2xl transition-opacity duration-300 group-hover:opacity-10 pointer-events-none" />
                </div>

                {/* Income Categories Card */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-md p-5 transition-[border-color,background-color,box-shadow] duration-200 hover:border-[var(--income)]/20 hover:bg-card/75">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Income Categories</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--income)]/10 text-[var(--income)]">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                            {incomeCategories.length}
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Inflow classifications</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[var(--income)] opacity-5 blur-2xl transition-opacity duration-300 group-hover:opacity-10 pointer-events-none" />
                </div>

                {/* Expense Categories Card */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-md p-5 transition-[border-color,background-color,box-shadow] duration-200 hover:border-[var(--expense)]/20 hover:bg-card/75">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Expense Categories</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--expense)]/10 text-[var(--expense)]">
                            <TrendingDown className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                            {expenseCategories.length}
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Outflow classifications</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[var(--expense)] opacity-5 blur-2xl transition-opacity duration-300 group-hover:opacity-10 pointer-events-none" />
                </div>
            </div>

            {/* Income & Expense Splitting Column Panel */}
            <div className="grid gap-6 lg:grid-cols-2">
                <CategoryTileColumn
                    tone="income"
                    categories={incomeCategories}
                    onEdit={openEdit}
                    onRequestDelete={setCategoryToDelete}
                />
                <CategoryTileColumn
                    tone="expense"
                    categories={expenseCategories}
                    onEdit={openEdit}
                    onRequestDelete={setCategoryToDelete}
                />
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!isSaving) setIsDialogOpen(open) }}>
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
                                className="flex items-center gap-3 rounded-xl border p-4 bg-muted/20 backdrop-blur-sm"
                                style={{
                                    borderColor: `${formData.color}40`,
                                    boxShadow: `0 8px 30px -10px ${formData.color}20`,
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
                            <Label htmlFor="category-name">Name</Label>
                            <Input
                                id="category-name"
                                placeholder="Category name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category-type">Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value: Tone) =>
                                    setFormData({ ...formData, type: value })
                                }
                            >
                                <SelectTrigger id="category-type">
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
                                {SWATCHES.map((swatch) => (
                                    <button
                                        key={swatch.value}
                                        type="button"
                                        aria-label={`Select ${swatch.name} color`}
                                        aria-pressed={formData.color === swatch.value}
                                        title={swatch.name}
                                        className={cn(
                                            'h-8 w-8 cursor-pointer rounded-full transition-transform duration-150 hover:scale-110',
                                            formData.color === swatch.value && 'ring-2 ring-offset-2 ring-offset-background',
                                        )}
                                        style={{
                                            backgroundColor: swatch.value,
                                            boxShadow: formData.color === swatch.value ? `0 0 12px ${swatch.value}` : undefined,
                                            border: formData.color === swatch.value ? '2px solid white' : undefined,
                                        }}
                                        onClick={() => setFormData({ ...formData, color: swatch.value })}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Category Icon</Label>
                            <div className="grid grid-cols-5 gap-2 max-h-[140px] overflow-y-auto p-1 border border-border/30 rounded-xl bg-background/20">
                                {ICON_OPTIONS.map(({ value: iconName, name: iconNameLabel }) => {
                                    const IconOption = iconMap[iconName] || Tag
                                    const isSelected = formData.icon === iconName
                                    return (
                                        <button
                                            key={iconName}
                                            type="button"
                                            aria-label={`Select ${iconNameLabel} icon`}
                                            aria-pressed={isSelected}
                                            className={cn(
                                                'flex h-10 cursor-pointer items-center justify-center rounded-xl border border-border/40 bg-card/60 transition-[background-color,border-color,box-shadow,color] duration-150 hover:bg-muted',
                                                isSelected && 'border-transparent',
                                            )}
                                            style={
                                                isSelected
                                                    ? {
                                                          backgroundColor: `${formData.color}20`,
                                                          color: formData.color,
                                                          boxShadow: `0 0 10px ${formData.color}25`,
                                                          border: `2px solid ${formData.color}`,
                                                      }
                                                    : undefined
                                            }
                                            onClick={() => setFormData({ ...formData, icon: iconName })}
                                        >
                                            <IconOption className="h-4 w-4" />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
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
                                {editingCategory ? 'Update' : 'Create'} Category
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation (shared by income & expense tiles) */}
            <AlertDialog
                open={categoryToDelete !== null}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) setCategoryToDelete(null)
                }}
            >
                <AlertDialogContent className="sm:max-w-[425px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">
                            Delete Category
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Delete the category{" "}
                            <strong>"{categoryToDelete?.name}"</strong>? If it is in use
                            by transactions, the delete will fail. This action cannot be
                            undone.
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
                                'Delete Category'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

function CategoryTile({
    category,
    onEdit,
    onRequestDelete,
}: {
    category: Category
    onEdit: (category: Category) => void
    onRequestDelete: (category: Category) => void
}) {
    const IconComponent = iconMap[category.icon] || Tag
    return (
        // Hover styling is pure CSS: --tile-color drives both the border and
        // the soft glow so no JS mouseenter/mouseleave mutation is needed.
        <div
            className="group/tile relative flex items-center justify-between overflow-hidden rounded-xl border bg-background/25 p-3.5 backdrop-blur-sm transition-[border-color,box-shadow,background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-background/40 hover:border-[var(--tile-color)] hover:shadow-[0_10px_30px_-12px_var(--tile-color)] focus-within:border-[var(--tile-color)]"
            style={
                {
                    borderColor: `${category.color}30`,
                    '--tile-color': category.color,
                } as React.CSSProperties
            }
        >
            <div className="flex min-w-0 items-center gap-3">
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover/tile:scale-105"
                    style={{ backgroundColor: `${category.color}15` }}
                >
                    <IconComponent className="h-4 w-4" style={{ color: category.color }} />
                </div>
                <span className="truncate text-sm font-bold tracking-tight text-foreground">{category.name}</span>
            </div>
            <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity duration-200 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer text-muted-foreground hover:bg-background/80 hover:text-foreground"
                    aria-label={`Edit ${category.name}`}
                    onClick={() => onEdit(category)}
                >
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer text-destructive/80 hover:bg-background/80 hover:text-destructive"
                    aria-label={`Delete ${category.name}`}
                    onClick={() => onRequestDelete(category)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    )
}

/** One category column (income or expense) — identical layout, tone differs. */
function CategoryTileColumn({
    tone,
    categories,
    onEdit,
    onRequestDelete,
}: {
    tone: Tone
    categories: Category[]
    onEdit: (category: Category) => void
    onRequestDelete: (category: Category) => void
}) {
    const { Icon, chipClass, blobClass } = TONE_STYLES[tone]
    return (
        <section className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-[border-color,background-color] duration-200 hover:border-border/80 hover:bg-card/60">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
            <div className="relative mb-6 flex items-center gap-2">
                <div className={cn('rounded-xl p-2', chipClass)}>
                    <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold tracking-tight">
                    {tone === 'income' ? 'Income Categories' : 'Expense Categories'}
                </h3>
            </div>
            <div className="relative">
                {categories.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-border/40 bg-background/25 py-12 text-center text-sm text-muted-foreground">
                        No {tone} categories defined yet
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {categories.map((category) => (
                            <CategoryTile
                                key={category.id}
                                category={category}
                                onEdit={onEdit}
                                onRequestDelete={onRequestDelete}
                            />
                        ))}
                    </div>
                )}
            </div>
            <div
                className={cn(
                    'pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-5 blur-3xl transition-opacity duration-300 group-hover:opacity-10',
                    blobClass,
                )}
            />
        </section>
    )
}

/** Loading skeleton shaped like the loaded page layout. */
function CategoriesSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-9 w-full rounded-md sm:w-40" />
            </div>

            {/* Metric cards */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-36 rounded-xl" />
                ))}
            </div>

            {/* Two category columns with tiles */}
            <div className="grid gap-6 lg:grid-cols-2">
                {[1, 2].map((column) => (
                    <div key={column} className="rounded-xl border border-border/50 bg-card/50 p-6 space-y-6">
                        <Skeleton className="h-8 w-48" />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {[1, 2, 3, 4].map((tile) => (
                                <Skeleton key={tile} className="h-[68px] rounded-xl" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
