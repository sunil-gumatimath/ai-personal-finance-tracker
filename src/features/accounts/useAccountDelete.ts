import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Account } from "@/types";

/**
 * Two-phase delete: check how many transactions reference the account, warn
 * with the exact number, then delete.
 *
 * The warning number is not decoration — it is what the `cascade` flag is
 * derived from. `transactions.account_id` is `ON DELETE RESTRICT`, so an
 * account with linked rows cannot be removed unless the server also deletes
 * them in the same statement (`accounts.repository.ts` `deleteAccount`).
 */
export function useAccountDelete({ onDeleted }: { onDeleted: () => void | Promise<void> }) {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
	const [linkedTransactionsCount, setLinkedTransactionsCount] = useState(0);
	const [isDeleting, setIsDeleting] = useState(false);

	const initiateDelete = useCallback(async (account: Account) => {
		setAccountToDelete(account);

		try {
			// Counts rows where this account is the source OR the transfer
			// destination, so a transfer-only reference is not missed.
			const res = await api.accounts.linkedCount(account.id);
			setLinkedTransactionsCount(res.count);
		} catch (error) {
			console.error("Error checking transactions:", error);
			setLinkedTransactionsCount(0);
		}

		setIsDialogOpen(true);
	}, []);

	const handleDelete = useCallback(async () => {
		if (!accountToDelete) return;

		setIsDeleting(true);
		try {
			await api.accounts.delete(
				accountToDelete.id,
				linkedTransactionsCount > 0,
			);
			toast.success(`"${accountToDelete.name}" deleted successfully`);
			await onDeleted();
		} catch (error) {
			console.error("Error deleting account:", error);
			toast.error("Failed to delete account. Please try again.");
		} finally {
			setIsDeleting(false);
			setIsDialogOpen(false);
			setAccountToDelete(null);
			setLinkedTransactionsCount(0);
		}
	}, [accountToDelete, linkedTransactionsCount, onDeleted]);

	return {
		isDialogOpen,
		setIsDialogOpen,
		accountToDelete,
		linkedTransactionsCount,
		isDeleting,
		initiateDelete,
		handleDelete,
	};
}