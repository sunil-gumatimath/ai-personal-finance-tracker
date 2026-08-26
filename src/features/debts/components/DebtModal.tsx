import { Plus, Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { SWATCHES, debtTypes } from '@/hooks/useDebts'
import type { Debt } from '@/types'

interface DebtModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editingDebt: Debt | null
    formData: {
        name: string
        type: Debt['type']
        original_amount: string
        current_balance: string
        interest_rate: string
        minimum_payment: string
        due_day: string
        start_date: string
        end_date: string
        lender: string
        notes: string
        color: string
    }
    setFormData: React.Dispatch<React.SetStateAction<{
        name: string
        type: Debt['type']
        original_amount: string
        current_balance: string
        interest_rate: string
        minimum_payment: string
        due_day: string
        start_date: string
        end_date: string
        lender: string
        notes: string
        color: string
    }>>
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
    /** True while the create/update request is in flight. */
    isSaving?: boolean
}

export function DebtModal({
    open,
    onOpenChange,
    editingDebt,
    formData,
    setFormData,
    onSubmit,
    onCancel,
    isSaving = false,
}: DebtModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {editingDebt ? (
                            <>
                                <Pencil className="h-5 w-5 text-primary" />
                                Edit Debt
                            </>
                        ) : (
                            <>
                                <Plus className="h-5 w-5 text-primary" />
                                Add New Debt
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {editingDebt
                            ? 'Update details for this debt.'
                            : 'Add a new debt account to track and optimize payoffs.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-5">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="debt-name">Debt Name</Label>
                            <Input
                                id="debt-name"
                                placeholder="e.g., Chase Sapphire Credit Card"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Debt Type</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value: Debt['type']) =>
                                        setFormData({ ...formData, type: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {debtTypes.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="original_amount">Original Balance</Label>
                                <Input
                                    id="original_amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.original_amount}
                                    onChange={(e) => setFormData({ ...formData, original_amount: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="current_balance">Current Balance</Label>
                            <Input
                                id="current_balance"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Same as original if new"
                                required={!!editingDebt}
                                value={formData.current_balance}
                                onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                {editingDebt
                                    ? 'Required when editing — a blank field will not fall back to the original amount.'
                                    : 'Optional for new debts — leave blank to start at the original balance.'}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="interest_rate">Interest Rate (%)</Label>
                                <Input
                                    id="interest_rate"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.interest_rate}
                                    onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="minimum_payment">Minimum Monthly Payment</Label>
                                <Input
                                    id="minimum_payment"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.minimum_payment}
                                    onChange={(e) => setFormData({ ...formData, minimum_payment: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground -mt-2">
                            Tip: if the minimum payment doesn't cover the monthly interest, the
                            payoff planner will show this debt as never paying off.
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="due_day">Payment Due Day (1-31)</Label>
                                <Input
                                    id="due_day"
                                    type="number"
                                    min="1"
                                    max="31"
                                    placeholder="e.g. 15"
                                    value={formData.due_day}
                                    onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="lender">Lender / Financial Institution</Label>
                                <Input
                                    id="lender"
                                    placeholder="e.g. Wells Fargo"
                                    value={formData.lender}
                                    onChange={(e) => setFormData({ ...formData, lender: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start_date">Start Date</Label>
                                <Input
                                    id="start_date"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="end_date">End Date (Optional)</Label>
                                <Input
                                    id="end_date"
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Card Color Accent</Label>
                            <div className="flex flex-wrap gap-2">
                                {SWATCHES.map((color) => (
                                    <button
                                        key={color.value}
                                        type="button"
                                        className={cn(
                                            'h-7 w-7 rounded-full transition-transform duration-150 ease-out hover:scale-110 active:scale-95',
                                            formData.color === color.value
                                                ? 'ring-2 ring-offset-2 ring-primary scale-110'
                                                : 'ring-1 ring-inset ring-black/10'
                                        )}
                                        style={{ backgroundColor: color.value }}
                                        onClick={() => setFormData({ ...formData, color: color.value })}
                                        title={color.label}
                                        aria-label={`${color.label} accent`}
                                        aria-pressed={formData.color === color.value}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                placeholder="Additional details..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter className="sticky bottom-0 bg-background pt-2 gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && (
                                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                            )}
                            {editingDebt ? 'Update Debt' : 'Add Debt'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
