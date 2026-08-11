import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
	Download,
	Filter,
	Plus,
	RefreshCw,
	Search,
	Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	TransactionDialog,
	type TransactionFormData,
} from "@/components/transactions/TransactionDialog";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import { api } from "@/lib/api-client";
import { ApiError } from "@/lib/errors";
import { downloadTransactionsCsv } from "@/lib/transaction-csv";
import type {
	Account,
	Category,
	Transaction,
	TransactionCreatePayload,
} from "@/types";

const EMPTY_FORM: TransactionFormData = {
	type: "expense",
	amount: "",
	description: "",
	category_id: "",
	account_id: "",
	to_account_id: "",
	date: format(new Date(), "yyyy-MM-dd"),
	is_recurring: false,
	recurring_frequency: "",
	recurring_end_date: "",
};

export function Transactions() {
	const { user } = useAuth();
	const { formatCurrency } = usePreferences();
	const [loading, setLoading] = useState(true);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [filterType, setFilterType] = useState("all");
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingTransaction, setEditingTransaction] =
		useState<Transaction | null>(null);
	const [formData, setFormData] = useState<TransactionFormData>(EMPTY_FORM);
	const [aiPrompt, setAiPrompt] = useState("");
	const [aiLoading, setAiLoading] = useState(false);
	const [processingRecurring, setProcessingRecurring] = useState(false);

	const fetchData = useCallback(async () => {
		if (!user) {
			setLoading(false);
			return;
		}

		try {
			const [transactionsRes, categoriesRes, accountsRes] = await Promise.all([
				api.transactions.list(),
				api.categories.list(),
				api.accounts.list(),
			]);

			setTransactions(
				(Array.isArray(transactionsRes.transactions)
					? transactionsRes.transactions
					: []) as Transaction[],
			);
			setCategories(
				(Array.isArray(categoriesRes.categories)
					? categoriesRes.categories
					: []) as Category[],
			);
			setAccounts(
				(Array.isArray(accountsRes.accounts)
					? accountsRes.accounts
					: []
				).filter((a: Account) => a.is_active),
			);
		} catch (error) {
			console.error("Error fetching data:", error);
			toast.error("Failed to load transactions");
		} finally {
			setLoading(false);
		}
	}, [user]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const filteredTransactions = useMemo(() => {
		return transactions.filter((t) => {
			const matchesSearch =
				(t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ??
					false) ||
				(t.category?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ??
					false);
			const matchesType = filterType === "all" || t.type === filterType;
			return matchesSearch && matchesType;
		});
	}, [transactions, searchQuery, filterType]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;

		try {
			const transactionData: TransactionCreatePayload = {
				type: formData.type,
				amount: parseFloat(formData.amount),
				description: formData.description || null,
				category_id: formData.category_id || null,
				account_id: formData.account_id,
				date: formData.date,
				is_recurring: formData.is_recurring,
				recurring_frequency: formData.is_recurring
					? ((formData.recurring_frequency ||
							null) as TransactionCreatePayload["recurring_frequency"])
					: null,
				recurring_end_date: formData.is_recurring
					? formData.recurring_end_date || null
					: null,
				to_account_id:
					formData.type === "transfer" ? formData.to_account_id || null : null,
			};

			if (editingTransaction) {
				await api.transactions.update(editingTransaction.id, transactionData);
				toast.success("Transaction updated successfully");
			} else {
				await api.transactions.create(transactionData);
				toast.success("Transaction added successfully");
			}

			setIsDialogOpen(false);
			resetForm();
			fetchData();
		} catch (error) {
			console.error("Error saving transaction:", error);
			toast.error("Failed to save transaction");
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await api.transactions.delete(id);
			toast.success("Transaction deleted");
			fetchData();
		} catch (error) {
			console.error("Error deleting transaction:", error);
			toast.error("Failed to delete transaction");
		}
	};

	const handleEdit = (transaction: Transaction) => {
		setEditingTransaction(transaction);
		setFormData({
			type: transaction.type,
			amount: transaction.amount.toString(),
			description: transaction.description || "",
			category_id: transaction.category_id || "",
			account_id: transaction.account_id,
			to_account_id: transaction.to_account_id || "",
			date: transaction.date,
			is_recurring: transaction.is_recurring || false,
			recurring_frequency: transaction.recurring_frequency || "",
			recurring_end_date: transaction.recurring_end_date || "",
		});
		setIsDialogOpen(true);
	};

	const resetForm = () => {
		setEditingTransaction(null);
		setFormData({ ...EMPTY_FORM, account_id: accounts[0]?.id || "" });
	};

	const openAddDialog = () => {
		resetForm();
		setIsDialogOpen(true);
	};

	/** Natural-language quick entry: parse the prompt, prefill the dialog. */
	const handleAiParse = async () => {
		const prompt = aiPrompt.trim();
		if (!prompt) return;
		setAiLoading(true);
		try {
			const { parsed } = await api.ai.parseTransaction(prompt);
			const defaultAccountId = accounts[0]?.id || "";
			setEditingTransaction(null);
			setFormData({
				type: parsed.type,
				amount: parsed.amount.toString(),
				description: parsed.description || "",
				category_id: parsed.category_id || "",
				account_id: parsed.account_id || defaultAccountId,
				to_account_id: parsed.to_account_id || "",
				date: parsed.date || format(new Date(), "yyyy-MM-dd"),
				is_recurring: false,
				recurring_frequency: "",
				recurring_end_date: "",
			});
			setAiPrompt("");
			setIsDialogOpen(true);
			toast.success("Parsed — review and save");
		} catch (error) {
			console.error("AI parse error:", error);
			const message =
				error instanceof ApiError
					? error.message
					: "Could not parse that as a transaction";
			toast.error(message);
		} finally {
			setAiLoading(false);
		}
	};

	/** Materialize due recurring occurrences for this user right now. */
	const handleProcessRecurring = async () => {
		setProcessingRecurring(true);
		try {
			const result = await api.transactions.processRecurring();
			const created = Array.isArray(result.created) ? result.created.length : 0;
			if (created > 0) {
				toast.success(
					`Created ${created} recurring transaction${created === 1 ? "" : "s"}` +
						(result.completed > 0
							? `, completed ${result.completed} series`
							: ""),
				);
			} else {
				toast.info("No recurring transactions are due right now");
			}
			fetchData();
		} catch (error) {
			console.error("Process recurring error:", error);
			toast.error("Failed to process recurring transactions");
		} finally {
			setProcessingRecurring(false);
		}
	};

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
						Transactions
					</h1>
					<p className="text-sm sm:text-base text-muted-foreground">
						Manage and track all your financial transactions
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={handleProcessRecurring}
						disabled={processingRecurring}
						title="Create occurrences for due recurring transactions"
						className="flex-1 sm:flex-none"
					>
						<RefreshCw
							className={`mr-2 h-4 w-4 ${processingRecurring ? "animate-spin" : ""}`}
						/>
						<span className="hidden sm:inline">Process Recurring</span>
						<span className="sm:hidden">Recurring</span>
					</Button>
					<Button
						variant="outline"
						onClick={() => downloadTransactionsCsv(filteredTransactions)}
						className="flex-1 sm:flex-none"
					>
						<Download className="mr-2 h-4 w-4" />
						<span className="hidden sm:inline">Export CSV</span>
						<span className="sm:hidden">Export</span>
					</Button>
					<Button onClick={openAddDialog} className="flex-1 sm:flex-none">
						<Plus className="mr-2 h-4 w-4" />
						<span className="hidden sm:inline">Add Transaction</span>
						<span className="sm:hidden">Add</span>
					</Button>
				</div>
			</div>

			{/* AI Quick Add */}
			<div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:bg-card/80">
				<div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
				<div className="relative flex flex-col gap-3">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<Sparkles className="h-4 w-4 text-primary" />
						<span>Add with AI</span>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Input
							placeholder="Try: paid $45 for groceries yesterday, or salary of $2,000 on the 1st"
							value={aiPrompt}
							onChange={(e) => setAiPrompt(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleAiParse();
								}
							}}
							className="flex-1"
						/>
						<Button
							onClick={handleAiParse}
							disabled={aiLoading || !aiPrompt.trim()}
							variant="secondary"
						>
							<Sparkles
								className={`mr-2 h-4 w-4 ${aiLoading ? "animate-pulse" : ""}`}
							/>
							{aiLoading ? "Parsing…" : "Parse"}
						</Button>
					</div>
				</div>
			</div>

			{/* Filters */}
			<div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:bg-card/80">
				<div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
				<div className="relative flex flex-col gap-4 sm:flex-row">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Search transactions..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10"
						/>
					</div>
					<div className="flex gap-2">
						<Select value={filterType} onValueChange={setFilterType}>
							<SelectTrigger className="w-[140px]">
								<Filter className="mr-2 h-4 w-4" />
								<SelectValue placeholder="Filter" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="income">Income</SelectItem>
								<SelectItem value="expense">Expense</SelectItem>
								<SelectItem value="transfer">Transfer</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			{/* Transactions Table */}
			<div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-border hover:bg-card/80">
				<div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
				<div className="relative p-6 pb-2">
					<h3 className="text-base font-semibold">All Transactions</h3>
				</div>
				<div className="relative px-6 pb-6">
					<TransactionTable
						transactions={filteredTransactions}
						formatCurrency={formatCurrency}
						hasActiveFilters={!!(searchQuery || filterType !== "all")}
						onEdit={handleEdit}
						onDelete={handleDelete}
						onAdd={openAddDialog}
					/>
				</div>
			</div>

			{/* Add/Edit Dialog */}
			<TransactionDialog
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
				editingTransaction={editingTransaction}
				formData={formData}
				setFormData={setFormData}
				categories={categories}
				accounts={accounts}
				onSubmit={handleSubmit}
			/>
		</div>
	);
}
