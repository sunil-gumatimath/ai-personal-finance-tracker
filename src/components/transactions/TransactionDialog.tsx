import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Account, Category, Transaction } from "@/types";

export type TransactionFormData = {
	type: "income" | "expense" | "transfer";
	amount: string;
	description: string;
	category_id: string;
	account_id: string;
	to_account_id: string;
	date: string;
	is_recurring: boolean;
	recurring_frequency: "" | "daily" | "weekly" | "monthly" | "yearly";
	recurring_end_date: string;
};

type TransactionFormState = {
	formData: TransactionFormData;
	setFormData: Dispatch<SetStateAction<TransactionFormData>>;
};

interface TransactionDialogProps extends TransactionFormState {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editingTransaction: Transaction | null;
	categories: Category[];
	accounts: Account[];
	onSubmit: (e: React.FormEvent) => void;
	/** Submit-time validation message surfaced by the parent handler. */
	error?: string | null;
	/** True while the parent is saving — disables submit and blocks closing. */
	isSaving?: boolean;
}

type FieldErrors = {
	amount?: string;
	to_account_id?: string;
};

function FieldError({ id, message }: { id: string; message?: string }) {
	if (!message) return null;
	return (
		<p id={id} role="alert" className="text-xs text-destructive">
			{message}
		</p>
	);
}

function CategoryDot({ color }: { color: string }) {
	return (
		<span
			className="inline-block h-2 w-2 shrink-0 rounded-full"
			style={{ backgroundColor: color }}
			aria-hidden="true"
		/>
	);
}

/** Add/Edit transaction dialog with the full form. */
export function TransactionDialog({
	open,
	onOpenChange,
	editingTransaction,
	formData,
	setFormData,
	categories,
	accounts,
	onSubmit,
	error,
	isSaving = false,
}: TransactionDialogProps) {
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

	// Snapshot of the form as it looked when the dialog opened — the baseline
	// for dirty detection when Escape/backdrop/X try to close it.
	const initialFormRef = useRef<TransactionFormData | null>(null);
	useEffect(() => {
		if (open) {
			initialFormRef.current = formData;
			setFieldErrors({});
			setShowDiscardConfirm(false);
		}
		// Capture only on the open transition; formData changes are the edits
		// being tracked, not a reason to re-baseline.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const isDirty =
		initialFormRef.current !== null &&
		JSON.stringify(formData) !== JSON.stringify(initialFormRef.current);

	const validateAmount = (): string | undefined => {
		const trimmed = formData.amount.trim();
		if (!trimmed) return "Amount is required.";
		const parsed = Number.parseFloat(trimmed);
		if (!Number.isFinite(parsed) || parsed <= 0)
			return "Enter an amount greater than 0.";
		return undefined;
	};

	const validateTransferTarget = (): string | undefined =>
		formData.type === "transfer" && !formData.to_account_id
			? "Select a destination account."
			: undefined;

	/** Type changes must never leave stale selections behind. */
	const handleTypeChange = (value: "income" | "expense" | "transfer") => {
		const next = { ...formData, type: value };
		if (value === "transfer") {
			next.category_id = ""; // transfers never carry a category
		} else {
			next.to_account_id = ""; // leaving transfer — drop the destination
			// Drop a category that doesn't belong to the new type.
			const selected = categories.find((c) => c.id === formData.category_id);
			if (selected && selected.type !== value) next.category_id = "";
		}
		setFieldErrors((prev) => ({ ...prev, to_account_id: undefined }));
		setFormData(next);
	};

	const requestClose = () => {
		if (isSaving) return; // never abandon an in-flight save
		if (isDirty) setShowDiscardConfirm(true);
		else onOpenChange(false);
	};

	const handleFormSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const errors: FieldErrors = {
			amount: validateAmount(),
			to_account_id: validateTransferTarget(),
		};
		setFieldErrors(errors);
		if (errors.amount || errors.to_account_id) return;
		onSubmit(e);
	};

	return (
		<>
			<Dialog
				open={open}
				onOpenChange={(next) => {
					// Escape / backdrop / the X button all funnel through here so a
					// dirty form can confirm before discarding.
					if (next || isSaving) return;
					requestClose();
				}}
			>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>
							{editingTransaction ? "Edit Transaction" : "Add Transaction"}
						</DialogTitle>
						<DialogDescription>
							{editingTransaction
								? "Update the transaction details below."
								: "Enter the details for your new transaction."}
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleFormSubmit} className="space-y-4">
						{error && (
							<p
								role="alert"
								className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
							>
								{error}
							</p>
						)}
						<div className="space-y-2">
							<Label htmlFor="tx-type">Type</Label>
							<Select
								value={formData.type}
								onValueChange={handleTypeChange}
							>
								<SelectTrigger id="tx-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="income">Income</SelectItem>
									<SelectItem value="expense">Expense</SelectItem>
									<SelectItem value="transfer">Transfer</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="amount">Amount</Label>
							<Input
								id="amount"
								type="number"
								min="0.01"
								step="0.01"
								inputMode="decimal"
								placeholder="0.00"
								autoFocus
								value={formData.amount}
								onChange={(e) => {
									setFormData({ ...formData, amount: e.target.value });
									if (fieldErrors.amount)
										setFieldErrors((prev) => ({ ...prev, amount: undefined }));
								}}
								onBlur={() => {
									// Blur-time validation, but never scold a pristine field.
									if (!formData.amount.trim() && !fieldErrors.amount) return;
									setFieldErrors((prev) => ({
										...prev,
										amount: validateAmount(),
									}));
								}}
								required
								aria-invalid={Boolean(fieldErrors.amount) || undefined}
								aria-describedby={
									fieldErrors.amount ? "amount-error" : undefined
								}
							/>
							<FieldError
								id="amount-error"
								message={fieldErrors.amount}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="description">Description</Label>
							<Input
								id="description"
								placeholder="What was this for?"
								value={formData.description}
								onChange={(e) =>
									setFormData({ ...formData, description: e.target.value })
								}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="tx-category">
								Category{" "}
								<span className="text-xs font-normal text-muted-foreground">
									(optional)
								</span>
							</Label>
							<Select
								value={formData.category_id}
								onValueChange={(value) =>
									setFormData({ ...formData, category_id: value })
								}
							>
								<SelectTrigger id="tx-category">
									<SelectValue placeholder="Select category" />
								</SelectTrigger>
								<SelectContent>
									{categories
										.filter(
											(c) =>
												c.type === formData.type ||
												formData.type === "transfer",
										)
										.map((category) => (
											<SelectItem key={category.id} value={category.id}>
												<span className="flex items-center gap-2">
													<CategoryDot color={category.color} />
													{category.name}
												</span>
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="tx-from-account">
								{formData.type === "transfer" ? "From Account" : "Account"}
							</Label>
							<Select
								value={formData.account_id}
								onValueChange={(value) =>
									setFormData({ ...formData, account_id: value })
								}
							>
								<SelectTrigger id="tx-from-account">
									<SelectValue placeholder="Select account" />
								</SelectTrigger>
								<SelectContent>
									{accounts.map((account) => (
										<SelectItem key={account.id} value={account.id}>
											{account.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Show To Account field for transfers */}
						{formData.type === "transfer" && (
							<div className="space-y-2">
								<Label htmlFor="tx-to-account">To Account</Label>
								<Select
									value={formData.to_account_id}
									onValueChange={(value) => {
										setFormData({ ...formData, to_account_id: value });
										if (fieldErrors.to_account_id)
											setFieldErrors((prev) => ({
												...prev,
												to_account_id: undefined,
											}));
									}}
								>
									<SelectTrigger
										id="tx-to-account"
										aria-invalid={
											Boolean(fieldErrors.to_account_id) || undefined
										}
										aria-describedby={
											fieldErrors.to_account_id
												? "to-account-error"
												: undefined
										}
									>
										<SelectValue placeholder="Select destination account" />
									</SelectTrigger>
									<SelectContent>
										{accounts
											.filter((account) => account.id !== formData.account_id)
											.map((account) => (
												<SelectItem key={account.id} value={account.id}>
													{account.name}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
								<FieldError
									id="to-account-error"
									message={fieldErrors.to_account_id}
								/>
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor="date">Date</Label>
							<Input
								id="date"
								type="date"
								value={formData.date}
								onChange={(e) =>
									setFormData({ ...formData, date: e.target.value })
								}
								required
							/>
						</div>

						{/* Recurring Transaction Section */}
						<div className="space-y-3 rounded-lg border border-border p-3">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label
										htmlFor="recurring-toggle"
										className="text-sm font-medium"
									>
										Recurring Transaction
									</Label>
									<p className="text-xs text-muted-foreground">
										Automatically repeat this transaction
									</p>
								</div>
								<button
									type="button"
									role="switch"
									id="recurring-toggle"
									aria-checked={formData.is_recurring}
									aria-label="Toggle recurring transaction"
									onClick={() =>
										setFormData((prev) => ({
											...prev,
											is_recurring: !prev.is_recurring,
											// Keep the previously chosen frequency across
											// off/on toggles; only default when empty.
											recurring_frequency:
												prev.recurring_frequency || "monthly",
										}))
									}
									className={cn(
										"relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150",
										formData.is_recurring ? "bg-primary" : "bg-muted",
									)}
								>
									<span
										className={cn(
											"pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform duration-150",
											formData.is_recurring
												? "translate-x-4"
												: "translate-x-0.5",
										)}
									/>
								</button>
							</div>
							{formData.is_recurring && (
								<div className="space-y-2">
									<Label htmlFor="recurring-frequency">Frequency</Label>
									<Select
										value={formData.recurring_frequency}
										onValueChange={(
											value: "daily" | "weekly" | "monthly" | "yearly",
										) =>
											setFormData({
												...formData,
												recurring_frequency: value,
											})
										}
									>
										<SelectTrigger id="recurring-frequency">
											<Repeat className="mr-2 h-4 w-4 text-muted-foreground" />
											<SelectValue placeholder="Select frequency" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="daily">Daily</SelectItem>
											<SelectItem value="weekly">Weekly</SelectItem>
											<SelectItem value="monthly">Monthly</SelectItem>
											<SelectItem value="yearly">Yearly</SelectItem>
										</SelectContent>
									</Select>
									<div className="space-y-2 pt-1">
										<Label htmlFor="recurring-end-date">
											End Date (optional)
										</Label>
										<Input
											id="recurring-end-date"
											type="date"
											min={formData.date || undefined}
											value={formData.recurring_end_date}
											onChange={(e) =>
												setFormData({
													...formData,
													recurring_end_date: e.target.value,
												})
											}
											placeholder="No end date (repeats forever)"
										/>
										<p className="text-xs text-muted-foreground">
											Leave empty to repeat indefinitely.
										</p>
									</div>
								</div>
							)}
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={requestClose}
								disabled={isSaving}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isSaving}>
								{isSaving && (
									<Loader2
										className="mr-2 h-4 w-4 motion-safe:animate-spin"
										aria-hidden="true"
									/>
								)}
								{editingTransaction ? "Update" : "Add"} Transaction
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Discard confirmation for a dirty form */}
			<AlertDialog
				open={showDiscardConfirm}
				onOpenChange={setShowDiscardConfirm}
			>
				<AlertDialogContent className="sm:max-w-[425px]">
					<AlertDialogHeader>
						<AlertDialogTitle>Discard changes?</AlertDialogTitle>
						<AlertDialogDescription>
							This form has unsaved changes. Closing now will discard them.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="gap-2 sm:gap-2">
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={(e) => {
								e.preventDefault();
								setShowDiscardConfirm(false);
								onOpenChange(false);
							}}
						>
							Discard changes
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
