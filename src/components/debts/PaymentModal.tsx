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
}

export function PaymentModal({
    open,
    onOpenChange,
    selectedDebt,
    formData,
    setFormData,
    onSubmit,
    onCancel,
}: PaymentModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                    <DialogDescription>
                        Log a payment for <strong>{selectedDebt?.name}</strong>.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label htmlFor="payment-amount">Payment Amount</Label>
                            <Input
                                id="payment-amount"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="payment-principal">Principal Portion</Label>
                                <Input
                                    id="payment-principal"
                                    type="number"
                                    step="0.01"
                                    placeholder="Optional"
                                    value={formData.principal_amount}
                                    onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="payment-interest">Interest Portion</Label>
                                <Input
                                    id="payment-interest"
                                    type="number"
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
                        <Button type="submit">
                            Record Payment
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
