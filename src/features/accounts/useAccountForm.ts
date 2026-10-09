import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { ApiError } from "@/lib/errors";
import { toNumber } from "@/lib/number";
import { SWATCHES } from "@/lib/palette";
import type { Account } from "@/types";

export interface AccountFormData {
	name: string;
	type: Account["type"];
	balance: string;
	color: string;
	is_active: boolean;
}

/**
 * `balance` is a string in the form and a number on the wire: an empty input
 * must mean "0", and the API rejects non-finite values, so the parse has to
 * happen once here rather than in three input handlers.
 */
function emptyForm(): AccountFormData {
	return {
		name: "",
		type: "checking",
		balance: "",
		color: SWATCHES[0].value,
		is_active: true,
	};
}

export function useAccountForm({
	currency,
	onSaved,
}: {
	/** Default currency from preferences, applied to new/edited accounts. */
	currency: string;
	/** Called after a successful create/update so the caller can refetch. */
	onSaved: () => void | Promise<void>;
}) {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingAccount, setEditingAccount] = useState<Account | null>(null);
	const [formData, setFormData] = useState<AccountFormData>(emptyForm);
	const [isSaving, setIsSaving] = useState(false);

	const updateForm = useCallback((patch: Partial<AccountFormData>) => {
		setFormData((prev) => ({ ...prev, ...patch }));
	}, []);

	const openCreate = useCallback(() => {
		setEditingAccount(null);
		setFormData(emptyForm());
		setIsDialogOpen(true);
	}, []);

	// Extracted so the Active and Inactive card grids share one implementation;
	// it used to be inlined in both and the two copies had already drifted.
	const openEdit = useCallback((account: Account) => {
		setEditingAccount(account);
		setFormData({
			name: account.name,
			type: account.type,
			balance: toNumber(account.balance).toString(),
			color: account.color,
			is_active: account.is_active,
		});
		setIsDialogOpen(true);
	}, []);

	const close = useCallback(() => {
		if (!isSaving) setIsDialogOpen(false);
	}, [isSaving]);

	const submit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (isSaving) return;

			setIsSaving(true);
			try {
				const accountData = {
					name: formData.name,
					type: formData.type,
					balance: parseFloat(formData.balance) || 0,
					color: formData.color,
					icon: formData.type,
					is_active: formData.is_active,
					currency,
				};

				if (editingAccount) {
					await api.accounts.update(editingAccount.id, accountData);
					toast.success("Account updated successfully");
				} else {
					await api.accounts.create(accountData);
					toast.success("Account created successfully");
				}

				// Close only once the save has resolved, so a failure leaves the
				// user's input on screen.
				setEditingAccount(null);
				setFormData(emptyForm());
				setIsDialogOpen(false);
				await onSaved();
			} catch (error) {
				console.error("Error saving account:", error);
				// Surface the server's message. A validation mismatch (e.g. a
				// balance correction, which the API rejects outright) used to be
				// reported as a bare "Failed to save account".
				toast.error(
					error instanceof ApiError ? error.message : "Failed to save account",
				);
			} finally {
				setIsSaving(false);
			}
		},
		[editingAccount, formData, currency, isSaving, onSaved],
	);

	return {
		isDialogOpen,
		editingAccount,
		formData,
		updateForm,
		isSaving,
		openCreate,
		openEdit,
		close,
		submit,
	};
}