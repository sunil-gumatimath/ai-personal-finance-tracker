import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { usePreferences } from '@/hooks/usePreferences'
import { toNumber } from '@/lib/number'
import type { Debt } from '@/types'

interface PaymentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedDebt: Debt | null
    formData: {
        amount: string
        principal_amount: string
        interest_amount: string
        payment_date: string
        notes: string
    }
    setFormData: React.Dispatch<React.SetStateAction<{
        amount: string
        principal_amount: string
        interest_amount: string
        payment_date: string
        notes: string
    }>>
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
    /** True while the payment request is in flight. */
    isSaving?: boolean
}

export function PaymentModal({
    open,
    onOpenChange,
    selectedDebt,
    formData,
    setFormData,
    onSubmit,
    onCancel,
    isSaving = false,
}: PaymentModalProps) {
    const { formatCurrency } = usePreferences()
    const remaining = selectedDebt ? toNumber(selectedDebt.current_balance) : 0
    const enteredAmount = parseFloat(formData.amount)
    const overpays =
        Number.isFinite(enteredAmount) &&
        enteredAmount > 0 &&
        selectedDebt !== null &&
        enteredAmount > remaining

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                    <DialogDescription>
                        Log a payment for <strong>{selectedDebt?.name}</strong>.
                        {selectedDebt && (
                            <>
                                {' '}Balance: {formatCurrency(remaining)} · Min:{' '}
                                {formatCurrency(toNumber(selectedDebt.minimum_payment))}
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label htmlFor="payment-amount">Payment Amount</Label>
                            <Input
                                id="payment-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                            {overpays && (
                                <p className="text-xs font-medium text-amber-500">
                                    This amount is larger than the remaining balance.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="payment-principal">Principal Portion</Label>
                                <Input
                                    id="payment-principal"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Optional"
                                    value={formData.principal_amount}
                                    onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Leave blank to auto-split against the amount.
                                </p>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="payment-interest">Interest Portion</Label>
                                <Input
                                    id="payment-interest"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Optional"
                                    value={formData.interest_amount}
                                    onChange={(e) => setFormData({ ...formData, interest_amount: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="payment-date">Payment Date</Label>
                            <Input
                                id="payment-date"
                                type="date"
                                value={formData.payment_date}
                                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="payment-notes">Notes</Label>
                            <Textarea
                                id="payment-notes"
                                placeholder="e.g. Extra payment from side gig"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && (
                                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                            )}
                            Record Payment
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
