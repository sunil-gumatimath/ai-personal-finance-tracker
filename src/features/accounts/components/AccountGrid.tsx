import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Account } from "@/types";
import { AccountCard, ArchivedAccountCard } from "./AccountCard";

type CardActions = {
	onEdit: (account: Account) => void;
	onDelete: (account: Account) => void;
};

function Section({
	title,
	count,
	children,
}: {
	title: string;
	count: number;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between border-b border-border/50 pb-4">
				<h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">
					{title}
				</h2>
				<span className="text-xs font-bold text-muted-foreground">
					{count} {count === 1 ? "ACCOUNT" : "ACCOUNTS"}
				</span>
			</div>
			<div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
				{children}
			</div>
		</div>
	);
}

/** The Active + Inactive account grids. */
export function AccountGrid({
	activeAccounts,
	inactiveAccounts,
	formatCurrency,
	onEdit,
	onDelete,
}: CardActions & {
	activeAccounts: Account[];
	inactiveAccounts: Account[];
	formatCurrency: (amount: number) => string;
}) {
	return (
		<>
			{activeAccounts.length > 0 && (
				<Section title="Active Accounts" count={activeAccounts.length}>
					{activeAccounts.map((account) => (
						<AccountCard
							key={account.id}
							account={account}
							formatCurrency={formatCurrency}
							onEdit={onEdit}
							onDelete={onDelete}
						/>
					))}
				</Section>
			)}

			{inactiveAccounts.length > 0 && (
				<div className="space-y-6 pt-6">
					<Section title="Inactive Accounts" count={inactiveAccounts.length}>
						{inactiveAccounts.map((account) => (
							<ArchivedAccountCard
								key={account.id}
								account={account}
								formatCurrency={formatCurrency}
								onEdit={onEdit}
								onDelete={onDelete}
							/>
						))}
					</Section>
				</div>
			)}
		</>
	);
}

/** First-run state: no accounts exist at all. */
export function AccountsEmptyState({ onCreate }: { onCreate: () => void }) {
	return (
		<Card className="group relative overflow-hidden rounded-xl border-2 border-dashed border-border/50 bg-card/50 backdrop-blur-sm">
			<CardContent className="flex flex-col items-center justify-center py-16 text-center">
				<div className="relative mb-8">
					<div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full scale-150 group-hover:bg-primary/30 transition-colors" />
					<div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-secondary text-primary border border-primary/20 shadow-2xl">
						<Wallet className="h-7 w-7" />
					</div>
				</div>
				<h3 className="text-2xl font-black tracking-tight mb-2">Get Started</h3>
				<p className="text-muted-foreground max-w-sm mb-10 font-medium">
					Add your first account to start tracking your finances across banks,
					cards, and more.
				</p>
				<Button
					onClick={onCreate}
					className="h-12 px-10 rounded-xl gap-2 bg-primary shadow-xl shadow-primary/20 font-black tracking-wide"
				>
					<Plus className="h-5 w-5" />
					Create Account
				</Button>
			</CardContent>
		</Card>
	);
}

/** Trailing "add another" affordance, shown only once accounts exist. */
export function AddAccountPrompt({ onCreate }: { onCreate: () => void }) {
	return (
		<button
			onClick={onCreate}
			className="flex w-full items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border/50 bg-card/20 p-12 transition-[border-color,background-color] duration-200 hover:border-primary/50 hover:bg-primary/5 group"
		>
			<div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary border border-border/50 shadow-sm transition-[transform,border-color] duration-200 [@media(hover:hover)]:group-hover:scale-105 group-hover:border-primary/30">
				<Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
			</div>
			<span className="font-black text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-[0.2em] text-xs">
				Add New Account
			</span>
		</button>
	);
}