import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toNumber } from "@/lib/number";
import type { Account } from "@/types";
import { AccountTypeIcon } from "./AccountTypeIcon";
import { AccountCardActions } from "../AccountCardActions";

/**
 * Active account card.
 *
 * Migrated onto the shared `.surface` / `.surface-hover` primitives (see
 * `index.css`), which is what every other panel in the app uses. Previously
 * this card hand-rolled `bg-card/30 backdrop-blur-xl` plus its own
 * `transition-[transform,border-color,box-shadow] duration-200 ease-out`, so it
 * hovered differently from Budgets/Categories/Debts/Goals and sat a half-step
 * off the house radius.
 *
 * The transition lists `transform` explicitly alongside the two properties
 * `.surface-hover` animates: a bare Tailwind `transition-transform` utility
 * would win the cascade and silently drop the surface's border/bg transition.
 */
export function AccountCard({
	account,
	formatCurrency,
	onEdit,
	onDelete,
}: {
	account: Account;
	formatCurrency: (amount: number) => string;
	onEdit: (account: Account) => void;
	onDelete: (account: Account) => void;
}) {
	const color = account.color;

	return (
		<Card className="surface surface-hover backdrop-blur-xl flex flex-col gap-0 py-0 transition-[transform,border-color,background-color] duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-0.5">
			<div
				// Corner accent, not a card-wide wash. At h-40/w-40 with blur-50px
				// the radial covered roughly half the card, so two accounts read as
				// two different pastel cards (pink vs blue) rather than one system
				// — Debts keeps a neutral surface and tints only a small icon chip.
				// Smaller, tighter and fainter keeps the account colour legible
				// without tinting the whole surface.
				className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-[40px] opacity-[0.07] transition-opacity duration-200 group-hover:opacity-[0.13] pointer-events-none"
				style={{ backgroundColor: color }}
			/>

			<CardHeader className="p-6">
				<div className="flex items-center justify-between">
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/50 border border-border/50 shadow-inner transition-transform duration-200 [@media(hover:hover)]:group-hover:scale-105">
						<AccountTypeIcon
							type={account.type}
							className="h-6 w-6"
							style={{ color }}
						/>
					</div>
					<AccountCardActions
						account={account}
						onEdit={onEdit}
						onDelete={onDelete}
					/>
				</div>
			</CardHeader>

			<CardContent className="flex-1 space-y-6 px-6 pb-6">
				<div>
					<p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
						Current Balance
					</p>
					<h3
						className={cn(
							"text-3xl font-black tabular-nums tracking-tighter",
							toNumber(account.balance) >= 0
								? "text-foreground"
								: "text-[var(--expense)]",
						)}
					>
						{formatCurrency(toNumber(account.balance))}
					</h3>
				</div>

				<div className="flex items-center justify-between pt-6 border-t border-border/30">
					<div className="min-w-0">
						<CardTitle className="text-base font-bold truncate text-foreground">
							{account.name}
						</CardTitle>
						<Badge
							variant="secondary"
							className="mt-1 text-[9px] font-black tracking-widest uppercase py-0 px-1.5 h-4 border-0"
						>
							{account.type.replace("_", " ")}
						</Badge>
					</div>
					<div
						className="h-8 w-8 rounded-full border-2 border-background shadow-xl ring-1 ring-border/50"
						style={{ backgroundColor: color }}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

/** Archived (`is_active === false`) account card. */
export function ArchivedAccountCard({
	account,
	formatCurrency,
	onEdit,
	onDelete,
}: {
	account: Account;
	formatCurrency: (amount: number) => string;
	onEdit: (account: Account) => void;
	onDelete: (account: Account) => void;
}) {
	return (
		<Card
			className="surface group overflow-hidden gap-0 py-0 border-dashed transition-[border-color,background-color] duration-200"
			style={{ opacity: 0.75 }}
		>
			<CardHeader className="px-6 pt-6 pb-2">
				<div className="flex items-center justify-between">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 border border-border/50">
						<AccountTypeIcon
							type={account.type}
							className="h-5 w-5 text-muted-foreground"
						/>
					</div>
					<AccountCardActions
						account={account}
						onEdit={onEdit}
						onDelete={onDelete}
						muted
					/>
				</div>
			</CardHeader>
			<CardContent className="space-y-4 px-6 pb-6">
				<div>
					<p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
						Archived Balance
					</p>
					<h3
						className={cn(
							"text-xl font-black tracking-tighter tabular-nums",
							toNumber(account.balance) >= 0
								? "text-foreground"
								: "text-[var(--expense)]",
						)}
					>
						{formatCurrency(toNumber(account.balance))}
					</h3>
				</div>
				<div className="pt-4 border-t border-border/30">
					<CardTitle className="text-sm font-bold text-foreground">
						{account.name}
					</CardTitle>
				</div>
			</CardContent>
		</Card>
	);
}