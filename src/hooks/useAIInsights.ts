import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api-client";
import type { AiInsight } from "@/types/api";

// Shared API type — kept as a named alias so existing consumers of
// `import type { Insight } from "@/hooks/useAIInsights"` keep compiling.
export type Insight = AiInsight;

export function useAIInsights() {
	const { user } = useAuth();
	const [insights, setInsights] = useState<Insight[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchInsights = useCallback(async () => {
		if (!user) {
			setLoading(false);
			return [];
		}

		try {
			setLoading(true);
			setError(null);
			const res = await api.ai.insights.list();
			const rows = (res.insights || []) as Insight[];
			setInsights(rows);
			return rows;
		} catch (error) {
			console.error("Error fetching insights:", error);
			setError(
				error instanceof Error
					? error.message
					: "We couldn't load your AI insights right now.",
			);
			return [];
		} finally {
			setLoading(false);
		}
	}, [user]);

	const generateInsights = useCallback(
		async (forceRefresh = false) => {
			if (!user) {
				setLoading(false);
				return;
			}

			// 1. Try to fetch existing insights first (if not forcing refresh)
			if (!forceRefresh) {
				const existing = await fetchInsights();
				if (existing.length > 0) return;
			}

			try {
				setLoading(true);
				setError(null);
				const res = await api.ai.insights.generate(forceRefresh);
				const rows = (res.insights || []) as Insight[];
				setInsights(rows);
			} catch (error) {
				console.error("Error generating insights:", error);
				setError(
					error instanceof Error
						? error.message
						: "We couldn't generate new insights right now.",
				);
			} finally {
				setLoading(false);
			}
		},
		[user, fetchInsights],
	);

	const dismissInsight = useCallback(
		async (id: string) => {
			if (!user) return;
			try {
				await api.ai.insights.dismiss(id);
				setInsights((prev) => prev.filter((i) => i.id !== id));
			} catch (error) {
				console.error("Error dismissing insight:", error);
			}
		},
		[user],
	);

	useEffect(() => {
		// Initial load
		fetchInsights();
	}, [fetchInsights]);

	return {
		insights,
		loading,
		error,
		refresh: () => generateInsights(true),
		/** Plain re-fetch of existing insights — used by failure retry rows. */
		retry: fetchInsights,
		dismissInsight,
	};
}
