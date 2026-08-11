import type { Dispatch, SetStateAction } from "react";
import { Repeat } from "lucide-react";
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

export type TransactionFormState = {
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
}: TransactionDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
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
				<form onSubmit={onSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label>Type</Label>
						<Select
							value={formData.type}
							onValueChange={(value: "income" | "expense" | "transfer") =>
								setFormData({ ...formData, type: value })
							}
						>
							<SelectTrigger>
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
							step="0.01"
							placeholder="0.00"
							value={formData.amount}
							onChange={(e) =>
								setFormData({ ...formData, amount: e.target.value })
							}
							required
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
						<Label>Category</Label>
						<Select
							value={formData.category_id}
							onValueChange={(value) =>
								setFormData({ ...formData, category_id: value })
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select category" />
							</SelectTrigger>
							<SelectContent>
								{categories
									.filter(
										(c) =>
											c.type === formData.type || formData.type === "transfer",
									)
									.map((category) => (
										<SelectItem key={category.id} value={category.id}>
											{category.name}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>
							{formData.type === "transfer" ? "From Account" : "Account"}
						</Label>
						<Select
							value={formData.account_id}
							onValueChange={(value) =>
								setFormData({ ...formData, account_id: value })
							}
							required
						>
							<SelectTrigger>
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
							<Label>To Account</Label>
							<Select
								value={formData.to_account_id}
								onValueChange={(value) =>
									setFormData({ ...formData, to_account_id: value })
								}
								required
							>
								<SelectTrigger>
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
								<Label className="text-sm font-medium">
									Recurring Transaction
								</Label>
								<p className="text-xs text-muted-foreground">
									Automatically repeat this transaction
								</p>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={formData.is_recurring}
								onClick={() =>
									setFormData({
										...formData,
										is_recurring: !formData.is_recurring,
										recurring_frequency: !formData.is_recurring
											? "monthly"
											: "",
									})
								}
								className={cn(
									"relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
									formData.is_recurring ? "bg-primary" : "bg-muted",
								)}
							>
								<span
									className={cn(
										"pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
										formData.is_recurring ? "translate-x-4" : "translate-x-0.5",
									)}
								/>
							</button>
						</div>
						{formData.is_recurring && (
							<div className="space-y-2">
								<Label>Frequency</Label>
								<Select
									value={formData.recurring_frequency}
									onValueChange={(
										value: "daily" | "weekly" | "monthly" | "yearly",
									) => setFormData({ ...formData, recurring_frequency: value })}
								>
									<SelectTrigger>
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
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit">
							{editingTransaction ? "Update" : "Add"} Transaction
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
