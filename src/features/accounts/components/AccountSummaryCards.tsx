import {
	Sparkles,
	TrendingUp,
	TrendingDown,
	ArrowUpRight,
	ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AccountTotals } from "../account-totals";

/**
 * Net worth / assets / liabilities banner.
 *
 * Note the totals are computed from the *unfiltered* account list
 * (`summarizeAccounts`), while `activeCount` comes from the filtered one. That
 * split is intentional and preserved: filtering should change which cards you
 * see, never the headline number — but the badge does narrow with the filter.
 */
export function AccountSummaryCards({
	totals,
	activeCount,
	formatCurrency,
}: {
	totals: AccountTotals;
	/** Active accounts in the currently filtered view. */
	activeCount: number;
	formatCurrency: (amount: number) => string;
}) {
	return (
		<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
			<Card className="surface surface-hover backdrop-blur-sm sm:col-span-2 group border-primary/20">
				<div className="absolute inset-0 bg-gradient-to-r from-primary/12 to-transparent pointer-events-none" />
				<div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-[80px] group-hover:bg-primary/20 transition-colors duration-200 ease" />
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Sparkles className="h-4 w-4 text-[var(--warning)]" />
							<CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
								Total Net Worth
							</CardTitle>
						</div>
						<Badge
							variant="outline"
							className="bg-primary/10 text-primary border-primary/20 py-1 font-bold"
						>
							{activeCount} ACTIVE
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="pt-4">
					<div className="flex flex-col gap-1">
						<h2 className="text-4xl sm:text-5xl font-black tracking-tighter tabular-nums bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
							{formatCurrency(totals.totalBalance)}
						</h2>
						<div className="flex items-center gap-2 mt-2">
							{totals.totalBalance >= 0 ? (
								<Badge className="bg-[var(--income)]/10 text-[var(--income)] border-[var(--income)]/20 hover:bg-[var(--income)]/20 px-2 py-0.5 pointer-events-none font-bold">
									<TrendingUp className="h-3 w-3 mr-1" />
									SURPLUS
								</Badge>
							) : (
								<Badge className="bg-[var(--expense)]/10 text-[var(--expense)] border-[var(--expense)]/20 hover:bg-[var(--expense)]/20 px-2 py-0.5 pointer-events-none font-bold">
									<TrendingDown className="h-3 w-3 mr-1" />
									DEFICIT
								</Badge>
							)}
							<span className="text-xs font-medium text-muted-foreground">
								Combined balance of active accounts
							</span>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="surface backdrop-blur-md group border-[var(--income)]/20 bg-[var(--income)]/[0.03]">
				<div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--income)]/10 blur-3xl [@media(hover:hover)]:group-hover:scale-125 motion-reduce:group-hover:scale-100 transition-transform" />
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<CardTitle className="text-[10px] font-black uppercase tracking-widest text-[var(--income)]/70">
							Total Assets
						</CardTitle>
						<div className="p-2 rounded-lg bg-[var(--income)]/10 text-[var(--income)] border border-[var(--income)]/20">
							<ArrowUpRight className="h-3.5 w-3.5" />
						</div>
					</div>
				</CardHeader>
				<CardContent className="pt-4">
					<div className="text-2xl font-black tabular-nums text-[var(--income)] tracking-tight">
						{formatCurrency(totals.totalAssets)}
					</div>
				</CardContent>
			</Card>

			<Card className="surface backdrop-blur-md group border-[var(--expense)]/20 bg-[var(--expense)]/[0.03]">
				<div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--expense)]/10 blur-3xl [@media(hover:hover)]:group-hover:scale-125 motion-reduce:group-hover:scale-100 transition-transform" />
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<CardTitle className="text-[10px] font-black uppercase tracking-widest text-[var(--expense)]/70">
							Liabilities
						</CardTitle>
						<div className="p-2 rounded-lg bg-[var(--expense)]/10 text-[var(--expense)] border border-[var(--expense)]/20">
							<ArrowDownRight className="h-3.5 w-3.5" />
						</div>
					</div>
				</CardHeader>
				<CardContent className="pt-4">
					<div className="text-2xl font-black tabular-nums text-[var(--expense)] tracking-tight">
						{formatCurrency(totals.totalLiabilities)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}