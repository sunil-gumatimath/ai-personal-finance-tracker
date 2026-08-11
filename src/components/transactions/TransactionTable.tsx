import { format } from "date-fns";
import {
	ArrowDownLeft,
	ArrowUpRight,
	MoreHorizontal,
	Pencil,
	Plus,
	Repeat,
	Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

interface TransactionTableProps {
	transactions: Transaction[];
	formatCurrency: (amount: number) => string;
	hasActiveFilters: boolean;
	onEdit: (transaction: Transaction) => void;
	onDelete: (id: string) => void;
	onAdd: () => void;
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

function TypeBadgeClasses({ type }: { type: Transaction["type"] }) {
	return cn(
		"flex items-center justify-center rounded-full",
		type === "income"
			? "bg-green-500/10 text-green-500"
			: type === "expense"
				? "bg-red-500/10 text-red-500"
				: "bg-blue-500/10 text-blue-500",
	);
}

function RowActions({
	transaction,
	onEdit,
	onDelete,
}: {
	transaction: Transaction;
	onEdit: (t: Transaction) => void;
	onDelete: (id: string) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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
					onClick={() => onDelete(transaction.id)}
				>
					<Trash2 className="mr-2 h-4 w-4" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function MobileCards({
	transactions,
	formatCurrency,
	onEdit,
	onDelete,
}: {
	transactions: Transaction[];
	formatCurrency: (amount: number) => string;
	onEdit: (t: Transaction) => void;
	onDelete: (id: string) => void;
}) {
	return (
		<div className="block md:hidden space-y-3">
			{transactions.map((transaction) => (
				<div
					key={transaction.id}
					className="flex items-center justify-between rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/50"
				>
					<div className="flex items-center gap-3 flex-1 min-w-0">
						<div
							className={cn(
								"h-10 w-10 shrink-0",
								TypeBadgeClasses({ type: transaction.type }),
							)}
						>
							<TypeIcon type={transaction.type} className="h-5 w-5" />
						</div>
						<div className="flex-1 min-w-0">
							<p className="font-medium truncate">
								{transaction.description || "No description"}
							</p>
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span>{format(new Date(transaction.date), "MMM d")}</span>
								{transaction.category && (
									<>
										<span>•</span>
										<span className="truncate">
											{transaction.category.name}
										</span>
									</>
								)}
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<span
							className={cn(
								"font-semibold text-sm",
								transaction.type === "income"
									? "text-green-500"
									: "text-red-500",
							)}
						>
							{transaction.type === "income" ? "+" : "-"}
							{formatCurrency(Math.abs(transaction.amount))}
						</span>
						<RowActions
							transaction={transaction}
							onEdit={onEdit}
							onDelete={onDelete}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

function DesktopTable({
	transactions,
	formatCurrency,
	onEdit,
	onDelete,
}: {
	transactions: Transaction[];
	formatCurrency: (amount: number) => string;
	onEdit: (t: Transaction) => void;
	onDelete: (id: string) => void;
}) {
	return (
		<div className="hidden md:block">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Type</TableHead>
						<TableHead>Description</TableHead>
						<TableHead>Category</TableHead>
						<TableHead>Account</TableHead>
						<TableHead>Date</TableHead>
						<TableHead className="text-right">Amount</TableHead>
						<TableHead className="w-[50px]"></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{transactions.map((transaction) => (
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
							<TableCell className="font-medium">
								<div className="flex items-center gap-2">
									{transaction.description || "No description"}
									{transaction.is_recurring && (
										<Badge variant="outline" className="gap-1 text-xs">
											<Repeat className="h-3 w-3" />
											{transaction.recurring_frequency}
										</Badge>
									)}
								</div>
							</TableCell>
							<TableCell>
								{transaction.category ? (
									<Badge variant="secondary">{transaction.category.name}</Badge>
								) : (
									<span className="text-muted-foreground">—</span>
								)}
							</TableCell>
							<TableCell>{transaction.account?.name || "—"}</TableCell>
							<TableCell>
								{format(new Date(transaction.date), "MMM d, yyyy")}
							</TableCell>
							<TableCell
								className={cn(
									"text-right font-semibold",
									transaction.type === "income"
										? "text-green-500"
										: "text-red-500",
								)}
							>
								{transaction.type === "income" ? "+" : "-"}
								{formatCurrency(Math.abs(transaction.amount))}
							</TableCell>
							<TableCell>
								<RowActions
									transaction={transaction}
									onEdit={onEdit}
									onDelete={onDelete}
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
	onEdit,
	onDelete,
	onAdd,
}: TransactionTableProps) {
	if (transactions.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<div className="rounded-full bg-muted p-4">
					<ArrowUpRight className="h-8 w-8 text-muted-foreground" />
				</div>
				<h3 className="mt-4 text-lg font-semibold">No transactions found</h3>
				<p className="mt-2 text-sm text-muted-foreground">
					{hasActiveFilters
						? "Try adjusting your filters"
						: "Get started by adding your first transaction"}
				</p>
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
				transactions={transactions}
				formatCurrency={formatCurrency}
				onEdit={onEdit}
				onDelete={onDelete}
			/>
			{/* Desktop Table Layout */}
			<DesktopTable
				transactions={transactions}
				formatCurrency={formatCurrency}
				onEdit={onEdit}
				onDelete={onDelete}
			/>
		</>
	);
}
