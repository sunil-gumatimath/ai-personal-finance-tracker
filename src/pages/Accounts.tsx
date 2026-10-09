import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/system/ErrorState";
import { BalanceVisibilityToggle } from "@/components/system/BalanceVisibilityToggle";
import { PageHeading } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import type { Account } from "@/types";
import {
	AccountSummaryCards,
	AccountsEmptyState,
	AccountsSkeleton,
	AccountFiltersBar,
	AccountGrid,
	AddAccountPrompt,
	AccountFormDialog,
	DeleteAccountDialog,
	NoAccountsFound,
	filterAndSortAccounts,
	partitionByActive,
	summarizeAccounts,
	useAccountDelete,
	useAccountFilters,
	useAccountForm,
	useAccountList,
} from "@/features/accounts";

/**
 * Accounts page — orchestration only.
 *
 * This file was 1018 lines holding every card, dialog, filter and reducer in
 * one component body. All of that now lives under `features/accounts/`, with
 * the derivation logic (filter/sort/totals) in pure, tested functions. What is
 * left here is the wiring: fetch, filter state, two dialogs, and composition.
 */
export function Accounts() {
	const { user } = useAuth();
	const { formatCurrency, preferences } = usePreferences();

	const { accounts, loading, fetchError, handleRetry, refetch } = useAccountList(
		user?.id,
	);

	const {
		searchQuery,
		filterType,
		sortBy,
		setSearchQuery,
		setFilterType,
		setSortBy,
		clearFilters,
	} = useAccountFilters();

	// Totals come from the full list so that filtering the grid never changes
	// the headline net worth.
	const totals = useMemo(() => summarizeAccounts(accounts), [accounts]);

	const { activeAccounts, inactiveAccounts } = useMemo(
		() =>
			partitionByActive(
				filterAndSortAccounts(accounts, { searchQuery, filterType, sortBy }),
			),
		[accounts, searchQuery, filterType, sortBy],
	);

	const form = useAccountForm({
		currency: preferences.currency,
		onSaved: refetch,
	});

	const del = useAccountDelete({ onDeleted: refetch });

	if (loading) {
		return <AccountsSkeleton />;
	}

	if (fetchError) {
		return (
			<div className="py-8">
				<ErrorState
					title="Couldn't load accounts"
					message="We couldn't load your accounts. Check your connection and try again."
					onRetry={handleRetry}
				/>
			</div>
		);
	}

	const hasAccounts = accounts.length > 0;

	return (
		<div className="space-y-6 animate-in fade-in duration-300">
			<PageHeading
				path="/accounts"
				subtitle={`Manage your financial accounts · ${accounts.length} ${
					accounts.length === 1 ? "account" : "accounts"
				}`}
				actions={
					<>
						<BalanceVisibilityToggle />
						<Button onClick={form.openCreate} className="w-full sm:w-auto">
							<Plus className="mr-2 h-4 w-4" />
							Add Account
						</Button>
					</>
				}
			/>

			<AccountSummaryCards
				totals={totals}
				activeCount={activeAccounts.length}
				formatCurrency={formatCurrency}
			/>

			{hasAccounts && (
				<AccountFiltersBar
					searchQuery={searchQuery}
					filterType={filterType}
					sortBy={sortBy}
					onSearchChange={setSearchQuery}
					onFilterChange={setFilterType}
					onSortChange={setSortBy}
				/>
			)}

			{hasAccounts &&
				activeAccounts.length === 0 &&
				inactiveAccounts.length === 0 && (
					<NoAccountsFound onClearFilters={clearFilters} />
				)}

			{hasAccounts && (activeAccounts.length > 0 || inactiveAccounts.length > 0) && (
				<AccountGrid
					activeAccounts={activeAccounts}
					inactiveAccounts={inactiveAccounts}
					formatCurrency={formatCurrency}
					onEdit={form.openEdit}
					onDelete={(account: Account) => void del.initiateDelete(account)}
				/>
			)}

			{!hasAccounts && <AccountsEmptyState onCreate={form.openCreate} />}

			{hasAccounts && <AddAccountPrompt onCreate={form.openCreate} />}

			<AccountFormDialog
				open={form.isDialogOpen}
				onOpenChange={(open) => {
					if (!open) form.close();
				}}
				editingAccount={form.editingAccount}
				formData={form.formData}
				onChange={form.updateForm}
				onSubmit={(e) => void form.submit(e)}
				isSaving={form.isSaving}
			/>

			<DeleteAccountDialog
				open={del.isDialogOpen}
				onOpenChange={del.setIsDialogOpen}
				account={del.accountToDelete}
				linkedTransactionsCount={del.linkedTransactionsCount}
				isDeleting={del.isDeleting}
				onConfirm={() => void del.handleDelete()}
			/>
		</div>
	);
}