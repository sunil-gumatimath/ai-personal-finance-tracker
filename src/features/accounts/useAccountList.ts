import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Account } from "@/types";

/**
 * Load the current user's accounts.
 *
 * The `user` guard is load-bearing: before, `fetchAccounts` ran on mount and
 * fired an unauthenticated `/api/accounts` request that 401'd and surfaced as
 * a spurious "Couldn't load accounts" error on every cold start.
 */
export function useAccountList(userId: string | undefined) {
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [loading, setLoading] = useState(true);
	const [fetchError, setFetchError] = useState(false);

	const fetchAccounts = useCallback(async () => {
		if (!userId) {
			setLoading(false);
			return;
		}

		try {
			const res = await api.accounts.list();
			setAccounts((res.accounts || []) as Account[]);
			setFetchError(false);
		} catch (error) {
			console.error("Error fetching accounts:", error);
			setFetchError(true);
		} finally {
			setLoading(false);
		}
	}, [userId]);

	useEffect(() => {
		void fetchAccounts();
	}, [fetchAccounts]);

	const handleRetry = useCallback(() => {
		setFetchError(false);
		setLoading(true);
		void fetchAccounts();
	}, [fetchAccounts]);

	return { accounts, loading, fetchError, handleRetry, refetch: fetchAccounts };
}