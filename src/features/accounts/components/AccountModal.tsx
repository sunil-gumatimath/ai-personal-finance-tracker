import { Plus, Pencil } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { COLORS } from '@/hooks/useAccounts'
import { ACCOUNT_TYPES } from './AccountCard'
import type { Account } from '@/types'

interface AccountModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editingAccount: Account | null
    formData: {
        name: string
        type: Account['type']
        balance: string
        color: string
        is_active: boolean
    }
    setFormData: React.Dispatch<React.SetStateAction<{
        name: string
        type: Account['type']
        balance: string
        color: string
        is_active: boolean
    }>>
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

export function AccountModal({
    open,
    onOpenChange,
    editingAccount,
    formData,
    setFormData,
    onSubmit,
    onCancel,
}: AccountModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {editingAccount ? (
                            <>
                                <Pencil className="h-5 w-5 text-primary" />
                                Edit Account
                            </>
                        ) : (
                            <>
                                <Plus className="h-5 w-5 text-primary" />
                                Add New Account
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {editingAccount
                            ? 'Update your account details below.'
                            : 'Add a new account to track your finances.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Account Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g., My Savings Account"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="h-11"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Account Type</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value: Account['type']) =>
                                        setFormData({ ...formData, type: value })
                                    }
                                >
                                    <SelectTrigger className="h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ACCOUNT_TYPES.map((type) => {
                                            const Icon = type.icon
                                            return (
                                                <SelectItem key={type.value} value={type.value}>
                                                    <div className="flex items-center gap-2">
                                                        <Icon className="h-4 w-4" />
                                                        {type.label}
                                                    </div>
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="balance">Current Balance</Label>
                                <Input
                                    id="balance"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.balance}
                                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                                    className="h-11"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Account Color</Label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map((color) => (
                                    <button
                                        key={color.value}
                                        type="button"
                                        className={cn(
                                            'h-9 w-9 rounded-full transition-all duration-200 hover:scale-110',
                                            formData.color === color.value
                                                ? 'ring-2 ring-offset-2 ring-primary scale-110'
                                                : 'ring-1 ring-inset ring-black/10'
                                        )}
                                        style={{ backgroundColor: color.value }}
                                        onClick={() => setFormData({ ...formData, color: color.value })}
                                        title={color.name}
                                        aria-label={`Select ${color.name} color`}
                                        aria-pressed={formData.color === color.value}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label htmlFor="is_active" className="text-base">Active Account</Label>
                                <p className="text-sm text-muted-foreground">
                                    Include this account in your total balance
                                </p>
                            </div>
                            <Switch
                                id="is_active"
                                checked={formData.is_active}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, is_active: checked })
                                }
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button type="button" variant="outline" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button type="submit" className="gap-2">
                            {editingAccount ? 'Update Account' : 'Add Account'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
