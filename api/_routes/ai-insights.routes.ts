import { getAuthedUserId } from "../_services/auth.service.js";
import { query, queryOne } from "../_repositories/db.js";
import {
	generateWithProvider,
	isFreeModel,
	type AIProviderPreferences,
} from "../_services/_ai_ai-provider.js";
import { decryptPreferences } from "../_utils/crypto.js";
import type { ApiRequest, ApiResponse } from "../_utils/types.js";
import { detectAnomalies, parseAiInsightsJson } from "../_domain/ai-insights.js";
import { assertUuid } from "../_domain/common.js";
import { DEFAULT_CURRENCY } from "../_config/server-config.js";
import { formatCurrency } from "../_utils/format.js";
import { sendApiError } from "../_utils/respond.js";

type Insight = {
	id: string;
	type: "anomaly" | "coaching" | "kudo";
	title: string;
	description: string;
	category?: string;
	amount?: number;
	date?: string;
	is_dismissed?: boolean;
	created_at?: string;
};

/** Active (non-dismissed) insights generated within the last 7 days. */
async function listActiveInsights(userId: string) {
	const { rows } = await query<Insight>(
		`
    SELECT * FROM ai_insights
    WHERE user_id = $1
    AND is_dismissed = false
    AND created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    `,
		[userId],
	);
	return rows;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
	const userId = await getAuthedUserId(req);
	if (!userId) {
		res.status(401).json({ error: "Unauthorized" });
		return;
	}

	// Handle ID-based operations (PATCH for dismiss)
	const id = req.query?.id;
	if (id && typeof id === "string") {
		if (req.method === "PATCH") {
			try {
				assertUuid(id, "insight ID");
				await query(
					"UPDATE ai_insights SET is_dismissed = true WHERE id = $1 AND user_id = $2",
					[id, userId],
				);
				res.status(200).json({ ok: true });
			} catch (error) {
				console.error("AI insight PATCH error:", error);
				sendApiError(res, error);
			}
			return;
		}

		res.status(405).json({ error: "Method not allowed" });
		return;
	}

	if (req.method === "GET") {
		try {
			const rows = await listActiveInsights(userId);
			res.status(200).json({ insights: rows });
		} catch (error) {
			console.error("AI insights GET error:", error);
			res.status(500).json({ error: "Server error" });
		}
		return;
	}

	if (req.method === "POST") {
		try {
			const { forceRefresh } = req.body || {};
			if (!forceRefresh) {
				const rows = await listActiveInsights(userId);
				if (rows.length > 0) {
					res.status(200).json({ insights: rows });
					return;
				}
			}

			const profile = await queryOne<{
				preferences: Record<string, unknown> | null;
				currency: string | null;
			}>("SELECT preferences, currency FROM profiles WHERE user_id = $1", [
				userId,
			]);
			const decryptedProfilePrefs = decryptPreferences(
				profile?.preferences || {},
			);
			const rawPrefs = decryptedProfilePrefs || {};
			const prefs = rawPrefs as AIProviderPreferences;
			const currency =
				typeof rawPrefs["currency"] === "string"
					? (rawPrefs["currency"] as string)
					: profile?.currency || DEFAULT_CURRENCY;
			const hasKiloKey =
				typeof prefs.kilocodeApiKey === "string" &&
				prefs.kilocodeApiKey.length > 0;

			type TransactionWithCategory = {
				type: string;
				amount: number | string | null;
				description: string | null;
				date: string;
				category: { name?: string } | null;
			};

			const { rows: transactions } = await query<TransactionWithCategory>(
				`
        SELECT t.*, row_to_json(c.*) as category
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id AND c.user_id = t.user_id
        WHERE t.user_id = $1
        AND t.date >= NOW() - INTERVAL '6 months'
        ORDER BY t.date DESC
        `,
				[userId],
			);

			const newInsights: Omit<Insight, "id">[] = [];

			// Rule-based anomaly detection (pure domain logic, currency-aware).
			const anomalies = detectAnomalies(
				(transactions || [])
					.filter((t) => t.type === "expense")
					.map((t) => ({
						type: "expense" as const,
						amount: Number(t.amount || 0),
						description: t.description,
						date: t.date,
						categoryName: t.category?.name ?? null,
					})),
				currency,
				(amount: number) => formatCurrency(amount, currency),
			);
			newInsights.push(...anomalies);

			const hasKey =
				hasKiloKey || Boolean(process.env.KILOCODE_API_KEY?.trim());

			if (hasKey && transactions.length > 0) {
				// Recompute per-category averages for the prompt.
				const spendingSummary: { category: string; average: number }[] = [];
				const categoryTotals = new Map<
					string,
					{ total: number; count: number }
				>();
				for (const t of transactions || []) {
					if (t.type === "expense") {
						const name = t.category?.name || "Uncategorized";
						const stats = categoryTotals.get(name) ?? { total: 0, count: 0 };
						stats.total += Number(t.amount || 0);
						stats.count += 1;
						categoryTotals.set(name, stats);
					}
				}
				for (const [cat, stats] of categoryTotals) {
					spendingSummary.push({
						category: cat,
						average: stats.total / stats.count,
					});
				}

				const prompt = `
I am a personal finance AI agent. Analyze the following spending data:
Currency: ${currency}
Category Stats: ${JSON.stringify(spendingSummary)}

Generate 2-3 specific, actionable financial insights focusing on:
- Spending shifts (Coaching)
- Success stories where spending decreased (Kudo)
- Actionable advice

Return ONLY a JSON object containing an insights array:
{"insights": [{"type": "coaching" | "kudo", "title": "Title", "description": "Description"}]}
No markdown, no extra text, and NO emojis.
        `;

				const options = {
					responseMimeType: "application/json",
				};

				// A stale/non-free saved model falls back to the server default
				// instead of silently disabling AI insight generation.
				const aiPrefs: AIProviderPreferences = { ...prefs };
				if (
					typeof aiPrefs.kilocodeModel === "string" &&
					!isFreeModel(aiPrefs.kilocodeModel)
				) {
					delete aiPrefs.kilocodeModel;
				}

				try {
					const aiResponse = await generateWithProvider(
						prompt,
						aiPrefs,
						options,
					);
					if (aiResponse) {
						// Strictly validate whatever the model returned; never trust it.
						const aiInsights = parseAiInsightsJson(aiResponse);
						newInsights.push(...aiInsights);
					}
				} catch (e) {
					console.error("Failed to generate AI insights:", e);
				}
			}

			if (newInsights.length === 0) {
				newInsights.push({
					type: "coaching",
					title: "Financial Health Tip",
					description:
						"Try the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings.",
				});
			}

			// Replace the previously generated, still-active insights so repeated
			// refreshes never accumulate duplicate rows. Dismissed history is kept.
			// Atomic single statement (the Neon HTTP driver has no multi-statement
			// transactions): one CTE deletes stale rows, the INSERT writes all new
			// ones — readers never observe an empty or half-written state.
			const insertValues: unknown[] = [userId];
			const valueRows = newInsights.map((insight) => {
				const base = insertValues.length;
				insertValues.push(
					insight.type,
					insight.title,
					insight.description,
					insight.category || null,
					insight.amount ?? null,
					insight.date || null,
				);
				const p = (offset: number) => `$${base + offset}`;
				return `($1, ${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)}, ${p(6)})`;
			});

			const { rows: saved } = await query<Insight>(
				`
        WITH del AS (
          DELETE FROM ai_insights WHERE user_id = $1 AND is_dismissed = false RETURNING 1
        )
        INSERT INTO ai_insights (user_id, type, title, description, category, amount, date)
        VALUES ${valueRows.join(", ")}
        RETURNING *
        `,
				insertValues,
			);

			res.status(200).json({ insights: saved });
		} catch (error) {
			console.error("AI insights POST error:", error);
			res.status(500).json({ error: "Server error" });
		}
		return;
	}

	res.status(405).json({ error: "Method not allowed" });
}
