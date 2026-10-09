import {
	Wallet,
	CreditCard,
	PiggyBank,
	Building,
	LineChart,
	Banknote,
} from "lucide-react";
import type { Account } from "@/types";

/**
 * Presentation metadata for the six account types the API accepts
 * (`api/_domain/accounts.ts` ACCOUNT_TYPES).
 *
 * These values used to live inline in `pages/Accounts.tsx`, where they were
 * consumed by three separate surfaces — the type `<Select>` in the form dialog,
 * the `<Select>` in the filter bar, and `getAccountIcon` on the cards. The icon
 * lookup in particular was a linear `find` executed once per card per render.
 */
export const ACCOUNT_TYPES = [
	{
		value: "checking",
		label: "Checking Account",
		icon: Building,
		gradient: "from-blue-500 to-blue-600",
	},
	{
		value: "savings",
		label: "Savings Account",
		icon: PiggyBank,
		gradient: "from-emerald-500 to-emerald-600",
	},
	{
		value: "credit",
		label: "Credit Card",
		icon: CreditCard,
		gradient: "from-purple-500 to-purple-600",
	},
	{
		value: "investment",
		label: "Investment",
		icon: LineChart,
		gradient: "from-amber-500 to-orange-600",
	},
	{
		value: "cash",
		label: "Cash",
		icon: Banknote,
		gradient: "from-green-500 to-green-600",
	},
	{
		value: "other",
		label: "Other",
		icon: Wallet,
		gradient: "from-slate-500 to-slate-600",
	},
] as const satisfies ReadonlyArray<{
	value: Account["type"];
	label: string;
	icon: typeof Wallet;
	gradient: string;
}>;

export type SortOption = "name" | "balance" | "type" | "created";

export const SORT_OPTIONS: ReadonlyArray<{ value: SortOption; label: string }> = [
	{ value: "name", label: "Name" },
	{ value: "balance", label: "Balance" },
	{ value: "type", label: "Type" },
	{ value: "created", label: "Newest" },
];

/** Human label for an account type, falling back to the raw stored value. */
export function getAccountTypeLabel(type: string) {
	return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;
}