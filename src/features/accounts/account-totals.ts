import { toNumber } from "@/lib/number";
import type { Account } from "@/types";
import type { SortOption } from "./account-types";

/**
 * Pure derivation of everything the Accounts page displays from the raw rows.
 *
 * This was inline in the `Accounts` component body: four `reduce` chains and
 * a `filter`/`sort` pair recomputed on every render, with the results threaded
 * through JSX. Extracting them makes the two rules that actually matter
 * testable, and both are easy to get subtly wrong:
 *
 *  1. Totals are computed from the UNFILTERED list. Search and the type filter
 *     change which cards you see; they must never change your net worth.
 *  2. Liabilities come from negative balances (a credit card is an
 *     obligation), and are reported as a positive magnitude.
 */
export interface AccountTotals {
	/** Net worth: every active account, signed. */
	totalBalance: number;
	/** Positive balances only. */
	totalAssets: number;
	/** Negative balances only, as a positive magnitude. */
	totalLiabilities: number;
}

export function summarizeAccounts(accounts: Account[]): AccountTotals {
	const active = accounts.filter((a) => a.is_active);

	return {
		totalBalance: active.reduce((sum, a) => sum + toNumber(a.balance), 0),
		totalAssets: active
			.filter((a) => toNumber(a.balance) > 0)
			.reduce((sum, a) => sum + toNumber(a.balance), 0),
		totalLiabilities: Math.abs(
			active
				.filter((a) => toNumber(a.balance) < 0)
				.reduce((sum, a) => sum + toNumber(a.balance), 0),
		),
	};
}

/**
 * Apply the search box and the type filter, then the selected sort.
 *
 * Returns the sorted list; the caller partitions into active/archived, since
 * the grid is rendered as two sections and the sort has to apply across both.
 */
export function filterAndSortAccounts(
	accounts: Account[],
	{ searchQuery, filterType, sortBy }: {
		searchQuery: string;
		filterType: string;
		sortBy: SortOption;
	},
): Account[] {
	const needle = searchQuery.trim().toLowerCase();

	const filtered = accounts.filter((account) => {
		const matchesSearch =
			needle.length === 0 || account.name.toLowerCase().includes(needle);
		const matchesType = filterType === "all" || account.type === filterType;
		return matchesSearch && matchesType;
	});

	// Copy before sorting: `accounts` is React state, and sorting it in place
	// would mutate the array identity the list is derived from.
	return [...filtered].sort((a, b) => {
		switch (sortBy) {
			case "balance":
				return toNumber(b.balance) - toNumber(a.balance);
			case "type":
				return a.type.localeCompare(b.type);
			case "created":
				return (
					new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
				);
			case "name":
			default:
				return a.name.localeCompare(b.name);
		}
	});
}

/** Split a sorted list into the two grid sections the page renders. */
export function partitionByActive(accounts: Account[]) {
	return {
		activeAccounts: accounts.filter((a) => a.is_active),
		inactiveAccounts: accounts.filter((a) => !a.is_active),
	};
}