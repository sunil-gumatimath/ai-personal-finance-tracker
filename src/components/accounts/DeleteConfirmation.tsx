import { Trash2 } from 'lucide-react'
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
import type { Account } from '@/types'

interface DeleteConfirmationProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    account: Account | null
    linkedCount: number
    isDeleting: boolean
    onConfirm: () => void
}

export function DeleteConfirmation({
    open,
    onOpenChange,
    account,
    linkedCount,
    isDeleting,
    onConfirm,
}: DeleteConfirmationProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="sm:max-w-[425px]">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <Trash2 className="h-5 w-5" />
                        Delete Account
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                        <span className="block">
                            Are you sure you want to delete <strong>"{account?.name}"</strong>?
                        </span>
                        {linkedCount > 0 && (
                            <span className="block p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                                Warning: This account has {linkedCount} linked transaction{linkedCount !== 1 ? 's' : ''} that will also be deleted.
                            </span>
                        )}
                        <span className="block text-xs text-muted-foreground">
                            This action cannot be undone.
                        </span>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-2">
                    <AlertDialogCancel disabled={isDeleting}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault()
                            onConfirm()
                        }}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Account'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
