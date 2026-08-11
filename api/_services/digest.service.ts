import { query } from "../_repositories/db.js";
import { generateWithProvider, MissingApiKeyError } from "./_ai_ai-provider.js";
import { resolveAiPreferences } from "./ai-preferences.service.js";
import {
	parseDigestJson,
	renderDigestMarkdown,
	type DigestProse,
	type DigestStats,
} from "../_domain/ai-digest.js";
import { KiloCodeApiError } from "./_ai_ai-provider.js";

const CURRENCY_LOCALES: Record<string, string> = {
	USD: "en-US",
	INR: "en-IN",
	EUR: "de-DE",
	GBP: "en-GB",
	JPY: "ja-JP",
};

interface DigestContextRow {
	type: string;
	amount: number | string | null;
	description: string | null;
	date: string;
	category: { name?: string } | null;
}

interface DigestBudgetRow {
	amount: number | string | null;
	period: string;
	category_name: string | null;
	spent: number | string | null;
}

interface DigestGoalRow {
	name: string;
	target_amount: number | string | null;
	current_amount: number | string | null;
	deadline: string | null;
}

interface DigestDebtRow {
	name: string;
	current_balance: number | string | null;
	interest_rate: number | string | null;
}

const EMPTY_PROSE: DigestProse = {
	review: "",
	observation: "",
	tip: "",
	goal_callouts: [],
	debt_callouts: [],
};

/**
 * Generate the weekly digest content (markdown) for a user from their last 7
 * days of data.
 *
 * All numbers in the digest are computed server-side from the database; the
 * model only writes prose (via a strict JSON response), so invented figures
 * or broken structure are impossible. When the model's response is unusable,
 * a fully server-generated digest is returned instead of failing.
 *
 * Throws MissingApiKeyError when no AI key is configured.
 */
export async function generateWeeklyDigestContent(
	userId: string,
): Promise<string> {
	const { prefs, currency, hasKey } = await resolveAiPreferences(userId);
	if (!hasKey) {
		throw new MissingApiKeyError(
			"KiloCode API key is not configured. Please add it in Settings > Preferences > AI Integration.",
		);
	}

	const formatNumber = (value: unknown): number =>
		typeof value === "number" ? value : Number(value || 0);

	const money = (amount: number) =>
		new Intl.NumberFormat(CURRENCY_LOCALES[currency] || "en-US", {
			style: "currency",
			currency,
		}).format(amount);

	const [
		{ rows: transactions },
		{ rows: budgets },
		{ rows: goals },
		{ rows: debts },
	] = await Promise.all([
		query<DigestContextRow>(
			`SELECT t.type, t.amount, t.description, t.date, row_to_json(c.*) as category
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id AND c.user_id = t.user_id
         WHERE t.user_id = $1 AND t.date >= CURRENT_DATE - INTERVAL '7 days'
         ORDER BY t.date DESC`,
			[userId],
		),
		query<DigestBudgetRow>(
			`SELECT b.amount, b.period, c.name as category_name,
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) as spent
         FROM budgets b
         LEFT JOIN categories c ON b.category_id = c.id AND c.user_id = b.user_id
         LEFT JOIN transactions t ON t.category_id = b.category_id AND t.user_id = b.user_id
           AND t.date >= CASE b.period
             WHEN 'weekly'  THEN GREATEST(b.start_date, CURRENT_DATE - INTERVAL '7 days')
             WHEN 'monthly' THEN GREATEST(b.start_date, DATE_TRUNC('month', CURRENT_DATE))
             ELSE GREATEST(b.start_date, DATE_TRUNC('year', CURRENT_DATE))
           END
         WHERE b.user_id = $1 AND (b.end_date IS NULL OR b.end_date >= CURRENT_DATE)
         GROUP BY b.id, b.amount, b.period, c.name`,
			[userId],
		),
		query<DigestGoalRow>(
			`SELECT name, target_amount, current_amount, deadline FROM goals WHERE user_id = $1`,
			[userId],
		),
		query<DigestDebtRow>(
			`SELECT name, current_balance, interest_rate FROM debts WHERE user_id = $1 AND is_active = true`,
			[userId],
		),
	]);

	// ---- Server-computed stats (the only numbers the digest may show) --------
	const txList = transactions || [];
	const income = txList
		.filter((t) => t.type === "income")
		.reduce((sum, t) => sum + formatNumber(t.amount), 0);
	const expenses = txList
		.filter((t) => t.type === "expense")
		.reduce((sum, t) => sum + formatNumber(t.amount), 0);

	const categorySpending = new Map<string, number>();
	for (const t of txList) {
		if (t.type === "expense") {
			const name = t.category?.name || "Uncategorized";
			categorySpending.set(
				name,
				(categorySpending.get(name) || 0) + formatNumber(t.amount),
			);
		}
	}
	const categoryTotal = [...categorySpending.values()].reduce(
		(s, n) => s + n,
		0,
	);
	const topCategories = [...categorySpending.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([name, amount]) => ({
			name,
			amount,
			percent: categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0,
		}));

	const budgetStats = (budgets || []).map((b) => {
		const limit = formatNumber(b.amount);
		const spent = formatNumber(b.spent);
		const percent = limit > 0 ? (spent / limit) * 100 : 0;
		const status =
			percent >= 100
				? ("over" as const)
				: percent >= 80
					? ("at risk" as const)
					: ("on track" as const);
		return {
			category: b.category_name || "Uncategorized",
			spent,
			limit,
			percent,
			status,
		};
	});

	const goalStats = (goals || []).map((g) => {
		const target = formatNumber(g.target_amount);
		const current = formatNumber(g.current_amount);
		return {
			name: g.name,
			current,
			target,
			percent: target > 0 ? (current / target) * 100 : 0,
		};
	});

	const debtStats = (debts || []).map((d) => ({
		name: d.name,
		balance: formatNumber(d.current_balance),
		rate: formatNumber(d.interest_rate),
	}));

	const stats: DigestStats = {
		income,
		expenses,
		net: income - expenses,
		incomeCount: txList.filter((t) => t.type === "income").length,
		expenseCount: txList.filter((t) => t.type === "expense").length,
		topCategories,
		budgets: budgetStats,
		goals: goalStats,
		debts: debtStats,
		money,
	};

	// ---- Ask the model for prose only, as strict JSON -----------------------
	const context = `
**Data window:** the 7 days ending today (${new Date().toISOString().slice(0, 10)}).
**Currency:** ${currency}
**Income:** ${money(income)} (${stats.incomeCount} transactions)
**Expenses:** ${money(expenses)} (${stats.expenseCount} transactions)
**Net:** ${money(income - expenses)}
**Top categories:** ${topCategories.map((c) => `${c.name}: ${money(c.amount)} (${c.percent.toFixed(0)}%)`).join("; ") || "none"}
${
	txList
		.slice(0, 10)
		.map(
			(t) =>
				`- ${t.date} ${t.type === "income" ? "+" : t.type === "transfer" ? "⇄" : "-"}${money(formatNumber(t.amount))} ${t.category?.name ? `[${t.category.name}]` : ""} ${t.description || ""}`,
		)
		.join("\n") || "- No transactions."
}
**Budgets:** ${budgetStats.map((b) => `${b.category}: ${money(b.spent)} / ${money(b.limit)} (${b.percent.toFixed(0)}%, ${b.status})`).join("; ") || "none"}
**Goals:** ${goalStats.map((g) => `${g.name}: ${money(g.current)} / ${money(g.target)} (${g.percent.toFixed(0)}%)`).join("; ") || "none"}
**Debts:** ${debtStats.map((d) => `${d.name}: ${money(d.balance)} at ${d.rate}%`).join("; ") || "none"}
`;

	const prompt = `
You are a personal finance coach writing the prose for a user's weekly digest.

**The user's data (all numbers are computed — use them as-is, never compute or invent your own):**
${context}

Write the digest prose. Return ONLY a JSON object with exactly these keys:

{
  "review": "1-2 sentence summary of the week's income, spending and net",
  "observation": "one short observation about the top spending categories",
  "tip": "one actionable tip tailored to the data",
  "goal_callouts": ["one short note per goal worth mentioning (no numbers)"],
  "debt_callouts": ["one short note per debt worth mentioning (no numbers)"]
}

Rules:
1. Never invent numbers, transactions, categories, or totals — the numbers are provided; quote them if needed.
2. goal_callouts and debt_callouts: at most one note per item, no digits allowed.
3. Each string under 200 characters. No emojis. No markdown inside the strings. JSON only — no code fences, no extra text.
`;

	// JSON mode keeps reasoning models from leaking chain-of-thought into the
	// response. Some gateway models reject response_format with a 400 — for
	// those, retry in plain text mode and let the parser extract the JSON.
	let raw: string;
	try {
		raw = await generateWithProvider(prompt, prefs, {
			responseMimeType: "application/json",
		});
	} catch (error) {
		if (error instanceof KiloCodeApiError && error.status === 400) {
			raw = await generateWithProvider(prompt, prefs);
		} else {
			throw error;
		}
	}

	// Never trust the model: on any parse failure fall back to a fully
	// server-generated digest (renderer fills in neutral prose).
	const prose = parseDigestJson(raw) ?? EMPTY_PROSE;

	return stripEmojis(renderDigestMarkdown(stats, prose));
}

/**
 * Strip emoji (and variation selectors / flags) from generated text so the
 * digest stays consistent with the app's no-emoji style rules even when the
 * model ignores them.
 */
export function stripEmojis(text: string): string {
	return text
		.replace(/[\u{1F000}-\u{1FAFF}]/gu, "")
		.replace(/[\u{2600}-\u{27BF}]/gu, "")
		.replace(/[\u{2B00}-\u{2BFF}]/gu, "")
		.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
		.replace(/\u{FE0F}/gu, "")
		.replace(/[\s,;:.!?]+$/g, "")
		.replace(/\n{3,}/g, "\n\n");
}
