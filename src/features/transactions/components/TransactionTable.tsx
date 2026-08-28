import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
	ArrowDownLeft,
	ArrowUpDown,
	ArrowUpRight,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Inbox,
	Loader2,
	MoreHorizontal,
	Pencil,
	Plus,
	Repeat,
	Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { parseTransactionDate } from "@/lib/date-utils";
import { toNumber } from "@/lib/number";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types";

interface TransactionTableProps {
	transactions: Transaction[];
	formatCurrency: (amount: number) => string;
	hasActiveFilters: boolean;
	/** Resets the page's filter state — powers the "Clear filters" empty state. */
	onClearFilters?: () => void;
	onEdit: (transaction: Transaction) => void;
	onDelete: (id: string) => void | Promise<unknown>;
	onAdd: () => void;
}

type SortField = "date" | "amount" | "description" | "category";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [25, 50, 100] as const;

/** Money color by transaction semantics via theme tokens; transfers stay neutral. */
function amountColorClass(type: Transaction["type"]): string {
	if (type === "income") return "text-[var(--income)]";
	if (type === "expense") return "text-[var(--expense)]";
	return "text-foreground";
}

/** One glyph convention everywhere: + income, - expense, none for transfers. */
function amountPrefix(type: Transaction["type"]): string {
	if (type === "income") return "+";
	if (type === "expense") return "-";
	return "";
}

function TypeBadgeClasses({ type }: { type: Transaction["type"] }) {
	return cn(
		"flex items-center justify-center rounded-full",
		type === "income"
			? "bg-[var(--income)]/10 text-[var(--income)]"
			: type === "expense"
				? "bg-[var(--expense)]/10 text-[var(--expense)]"
				: "bg-muted text-muted-foreground",
	);
}

function capitalize(value: string): string {
	return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function AmountCell({
	transaction,
	formatCurrency,
	className,
}: {
	transaction: Transaction;
	formatCurrency: (amount: number) => string;
	className?: string;
}) {
	return (
		<span
			className={cn(
				amountColorClass(transaction.type),
				"font-semibold tabular-nums",
				className,
			)}
		>
			{amountPrefix(transaction.type)}
			{formatCurrency(Math.abs(toNumber(transaction.amount)))}
		</span>
	);
}

function CategoryBadge({ category }: { category: Category }) {
	return (
		<Badge variant="secondary" className="max-w-[160px] gap-1.5">
			<span
				className="inline-block h-2 w-2 shrink-0 rounded-full"
				style={{ backgroundColor: category.color }}
				aria-hidden="true"
			/>
			<span className="truncate">{category.name}</span>
		</Badge>
	);
}

function TypeIcon({
	type,
	className,
}: {
	type: Transaction["type"];
	className?: string;
}) {
	return type === "income" ? (
		<ArrowDownLeft className={className} />
	) : (
		<ArrowUpRight className={className} />
	);
}

function RowActions({
	transaction,
	onEdit,
	onRequestDelete,
}: {
	transaction: Transaction;
	onEdit: (t: Transaction) => void;
	/** Requests confirmation — the actual delete happens after the dialog. */
	onRequestDelete: (t: Transaction) => void;
}) {
	const label = transaction.description || "this transaction";
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 shrink-0"
					aria-label={`Actions for ${label}`}
				>
					<MoreHorizontal className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => onEdit(transaction)}>
					<Pencil className="mr-2 h-4 w-4" />
					Edit
				</DropdownMenuItem>
				<DropdownMenuItem
					className="text-destructive"
					onClick={() => onRequestDelete(transaction)}
				>
					<Trash2 className="mr-2 h-4 w-4" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function SortableHead({
	label,
	field,
	sortField,
	sortDir,
	onSort,
	align,
}: {
	label: string;
	field: SortField;
	sortField: SortField;
	sortDir: SortDir;
	onSort: (field: SortField) => void;
	align?: "right";
}) {
	const active = field === sortField;
	return (
		<TableHead
			aria-sort={
				active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
			}
			className={align === "right" ? "text-right" : undefined}
		>
			<button
				type="button"
				onClick={() => onSort(field)}
				aria-label={`Sort by ${label}`}
				className={cn(
					"inline-flex items-center gap-1 rounded text-sm font-medium transition-colors duration-150 hover:text-foreground",
					active ? "text-foreground" : "text-muted-foreground",
				)}
			>
				{label}
				{active ? (
					sortDir === "asc" ? (
						<ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
					) : (
						<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
					)
				) : (
					<ArrowUpDown
						className="h-3.5 w-3.5 opacity-60"
						aria-hidden="true"
					/>
				)}
			</button>
		</TableHead>
	);
}

function MobileCards({
	transactions,
	formatCurrency,
	onEdit,
	onRequestDelete,
}: {
	transactions: Transaction[];
	formatCurrency: (amount: number) => string;
	onEdit: (t: Transaction) => void;
	onRequestDelete: (t: Transaction) => void;
}) {
	return (
		<div className="block space-y-3 md:hidden">
			{transactions.map((transaction) => (
				<div
					key={transaction.id}
					className="flex items-center justify-between rounded-lg border border-border/50 p-3 transition-colors duration-150 hover:bg-muted/50"
				>
					<div className="flex flex-1 items-center gap-3 min-w-0">
						<div
							className={cn(
								"h-10 w-10 shrink-0",
								TypeBadgeClasses({ type: transaction.type }),
							)}
						>
							<TypeIcon type={transaction.type} className="h-5 w-5" />
						</div>
						<div className="flex-1 min-w-0">
							<p className="truncate font-medium">
								{transaction.description || "No description"}
							</p>
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span>
									{format(parseTransactionDate(transaction.date), "MMM d")}
								</span>
								{transaction.category && (
									<>
										<span>•</span>
										<span className="inline-flex min-w-0 items-center gap-1 truncate">
											<span
												className="inline-block h-2 w-2 shrink-0 rounded-full"
												style={{ backgroundColor: transaction.category.color }}
												aria-hidden="true"
											/>
											<span className="truncate">
												{transaction.category.name}
											</span>
										</span>
									</>
								)}
							</div>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<AmountCell
							transaction={transaction}
							formatCurrency={formatCurrency}
							className="text-sm"
						/>
						<RowActions
							transaction={transaction}
							onEdit={onEdit}
							onRequestDelete={onRequestDelete}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

function DesktopTable({
	rows,
	sortField,
	sortDir,
	onSort,
	onEdit,
	onRequestDelete,
	formatCurrency,
}: {
	rows: Transaction[];
	sortField: SortField;
	sortDir: SortDir;
	onSort: (field: SortField) => void;
	onEdit: (t: Transaction) => void;
	onRequestDelete: (t: Transaction) => void;
	formatCurrency: (amount: number) => string;
}) {
	return (
		<div className="hidden md:block">
			<Table>
				<TableHeader className="sticky top-0 z-10 bg-background">
					<TableRow>
						<TableHead className="w-[60px]">Type</TableHead>
						<SortableHead
							label="Description"
							field="description"
							sortField={sortField}
							sortDir={sortDir}
							onSort={onSort}
						/>
						<SortableHead
							label="Category"
							field="category"
							sortField={sortField}
							sortDir={sortDir}
							onSort={onSort}
						/>
						<TableHead>Account</TableHead>
						<SortableHead
							label="Date"
							field="date"
							sortField={sortField}
							sortDir={sortDir}
							onSort={onSort}
						/>
						<SortableHead
							label="Amount"
							field="amount"
							sortField={sortField}
							sortDir={sortDir}
							onSort={onSort}
							align="right"
						/>
						<TableHead className="w-[50px]">
							<span className="sr-only">Actions</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((transaction) => (
						<TableRow key={transaction.id}>
							<TableCell>
								<div
									className={cn(
										"h-8 w-8",
										TypeBadgeClasses({ type: transaction.type }),
									)}
								>
									<TypeIcon type={transaction.type} className="h-4 w-4" />
								</div>
							</TableCell>
							<TableCell className="max-w-[280px] font-medium">
								<div className="flex items-center gap-2">
									<span
										className="max-w-[280px] truncate"
										title={transaction.description || undefined}
									>
										{transaction.description || "No description"}
									</span>
									{transaction.is_recurring && (
										<Badge variant="outline" className="shrink-0 gap-1 text-xs">
											<Repeat className="h-3 w-3" />
											{capitalize(transaction.recurring_frequency ?? "") ||
												"Recurring"}
										</Badge>
									)}
								</div>
							</TableCell>
							<TableCell>
								{transaction.category ? (
									<CategoryBadge category={transaction.category} />
								) : (
									<span className="text-muted-foreground">—</span>
								)}
							</TableCell>
							<TableCell>{transaction.account?.name || "—"}</TableCell>
							<TableCell className="tabular-nums">
								{format(parseTransactionDate(transaction.date), "MMM d, yyyy")}
							</TableCell>
							<TableCell className="text-right">
								<AmountCell
									transaction={transaction}
									formatCurrency={formatCurrency}
								/>
							</TableCell>
							<TableCell>
								<RowActions
									transaction={transaction}
									onEdit={onEdit}
									onRequestDelete={onRequestDelete}
								/>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

/** Transactions list: empty state, mobile card layout, and desktop table. */
export function TransactionTable({
	transactions,
	formatCurrency,
	hasActiveFilters,
	onClearFilters,
	onEdit,
	onDelete,
	onAdd,
}: TransactionTableProps) {
	const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [sortField, setSortField] = useState<SortField>("date");
	const [sortDir, setSortDir] = useState<SortDir>("desc");
	const [pageSize, setPageSize] = useState<number>(25);
	const [page, setPage] = useState(1);

	const sortedTransactions = useMemo(() => {
		const factor = sortDir === "asc" ? 1 : -1;
		const sortValue = (t: Transaction): string | number => {
			switch (sortField) {
				case "date":
					return parseTransactionDate(t.date).getTime();
				case "amount":
					return toNumber(t.amount);
				case "description":
					return (t.description ?? "").toLowerCase();
				case "category":
					return (t.category?.name ?? "").toLowerCase();
			}
		};
		return [...transactions].sort((a, b) => {
			const va = sortValue(a);
			const vb = sortValue(b);
			if (va < vb) return -1 * factor;
			if (va > vb) return factor;
			return 0;
		});
	}, [transactions, sortField, sortDir]);

	// A changed result count means filters/search reshaped the list — restart at
	// page 1 so a stale page index can never point past the new result set.
	useEffect(() => {
		setPage(1);
	}, [transactions.length]);

	const pageCount = Math.max(
		1,
		Math.ceil(sortedTransactions.length / pageSize),
	);
	const safePage = Math.min(page, pageCount);
	const startIndex = (safePage - 1) * pageSize;
	const endIndex = Math.min(startIndex + pageSize, sortedTransactions.length);
	const visibleTransactions = useMemo(
		() => sortedTransactions.slice(startIndex, endIndex),
		[sortedTransactions, startIndex, endIndex],
	);

	const handleSort = (field: SortField) => {
		if (field === sortField) {
			setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
		} else {
			setSortField(field);
			// Money and time read most naturally newest/largest first.
			setSortDir(field === "date" || field === "amount" ? "desc" : "asc");
		}
	};

	const confirmDelete = async () => {
		if (!pendingDelete) return;
		setIsDeleting(true);
		try {
			await onDelete(pendingDelete.id);
		} finally {
			setIsDeleting(false);
			setPendingDelete(null);
		}
	};

	if (transactions.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<div className="rounded-full bg-muted p-4">
					<Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
				</div>
				<h3 className="mt-4 text-lg font-semibold">No transactions found</h3>
				<p className="mt-2 text-sm text-muted-foreground">
					{hasActiveFilters
						? "Try adjusting your filters"
						: "Get started by adding your first transaction"}
				</p>
				{hasActiveFilters && onClearFilters && (
					<Button variant="outline" className="mt-4" onClick={onClearFilters}>
						Clear filters
					</Button>
				)}
				{!hasActiveFilters && (
					<Button className="mt-4" onClick={onAdd}>
						<Plus className="mr-2 h-4 w-4" />
						Add Transaction
					</Button>
				)}
			</div>
		);
	}

	return (
		<>
			{/* Mobile Card Layout */}
			<MobileCards
				transactions={visibleTransactions}
				formatCurrency={formatCurrency}
				onEdit={onEdit}
				onRequestDelete={setPendingDelete}
			/>
			{/* Desktop Table Layout */}
			<DesktopTable
				rows={visibleTransactions}
				formatCurrency={formatCurrency}
				sortField={sortField}
				sortDir={sortDir}
				onSort={handleSort}
				onEdit={onEdit}
				onRequestDelete={setPendingDelete}
			/>

			{/* Pagination */}
			<div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-border/50 pt-4 sm:flex-row">
				<p
					className="text-sm text-muted-foreground tabular-nums"
					aria-live="polite"
				>
					Showing {startIndex + 1}&ndash;{endIndex} of{" "}
					{sortedTransactions.length}
				</p>
				<div className="flex items-center gap-3">
					<Select
						value={String(pageSize)}
						onValueChange={(value) => {
							setPageSize(Number(value));
							setPage(1);
						}}
					>
						<SelectTrigger
							className="h-8 w-[80px]"
							aria-label="Rows per page"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PAGE_SIZES.map((size) => (
								<SelectItem key={size} value={String(size)}>
									{size}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="icon"
							className="h-8 w-8"
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={safePage <= 1}
							aria-label="Previous page"
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<span className="min-w-[70px] text-center text-sm tabular-nums text-muted-foreground">
							Page {safePage} of {pageCount}
						</span>
						<Button
							variant="outline"
							size="icon"
							className="h-8 w-8"
							onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
							disabled={safePage >= pageCount}
							aria-label="Next page"
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			{/* Delete confirmation */}
			<AlertDialog
				open={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open && !isDeleting) setPendingDelete(null);
				}}
			>
				<AlertDialogContent className="sm:max-w-[425px]">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-destructive">
							Delete Transaction
						</AlertDialogTitle>
						<AlertDialogDescription>
							Delete{" "}
							<strong>
								"
								{pendingDelete?.description || "this transaction"}"
							</strong>
							? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="gap-2 sm:gap-2">
						<AlertDialogCancel disabled={isDeleting}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={isDeleting}
							onClick={(e) => {
								// Radix auto-closes on click; keep the dialog mounted so the
								// pending state is actually visible until the delete resolves.
								e.preventDefault();
								void confirmDelete();
							}}
						>
							{isDeleting ? (
								<>
									<Loader2
										className="mr-2 h-4 w-4 motion-safe:animate-spin"
										aria-hidden="true"
									/>
									Deleting…
								</>
							) : (
								"Delete"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
