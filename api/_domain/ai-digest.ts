/**
 * Pure domain logic for the weekly AI digest — strict JSON parsing of the
 * model's response and deterministic markdown rendering.
 *
 * Design: the model supplies ONLY prose (review / observation / tip /
 * callouts). Every number, percentage, and status in the rendered digest is
 * computed server-side from the user's real data, so the model cannot invent
 * figures, and the structure can never drift.
 */

export interface DigestProse {
	review: string;
	observation: string;
	tip: string;
	goal_callouts: string[];
	debt_callouts: string[];
}

export interface DigestBudgetStat {
	category: string;
	spent: number;
	limit: number;
	percent: number;
	status: "on track" | "at risk" | "over";
}

export interface DigestStats {
	income: number;
	expenses: number;
	net: number;
	incomeCount: number;
	expenseCount: number;
	topCategories: { name: string; amount: number; percent: number }[];
	budgets: DigestBudgetStat[];
	goals: { name: string; current: number; target: number; percent: number }[];
	debts: { name: string; balance: number; rate: number }[];
	money: (amount: number) => string;
}

const MAX_PROSE_LENGTH = 240;
const MAX_CALLOUT_LENGTH = 120;
const MAX_CALLOUTS = 5;

function cleanString(value: unknown, maxLength: number): string {
	if (typeof value !== "string") return "";
	return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Callouts are flavor text — never allow digits so no figures can be invented. */
function cleanCallout(value: unknown): string {
	if (typeof value !== "string") return "";
	const stripped = value
		.replace(/[₹$€£¥]?\s?[\d.,]+%?/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return stripped.slice(0, MAX_CALLOUT_LENGTH);
}

/**
 * Parse the model's JSON blob. Returns null when the payload is unusable
 * (callers fall back to a server-generated digest). Prose fields are
 * optional and clamped; callouts are digit-stripped.
 *
 * The extraction is defensive: reasoning models in plain-text mode may
 * prefix the JSON with chain-of-thought, so candidates are tried from the
 * end of the response backwards until one parses.
 */
export function parseDigestJson(raw: string): DigestProse | null {
	if (!raw || typeof raw !== "string") return null;

	const cleaned = raw
		.replace(/```json/gi, "")
		.replace(/```/g, "")
		.trim();
	if (!cleaned) return null;

	const parsed = extractJsonObject(cleaned);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
		return null;
	const record = parsed as Record<string, unknown>;

	const review = cleanString(record.review, MAX_PROSE_LENGTH);
	const observation = cleanString(record.observation, MAX_PROSE_LENGTH);
	const tip = cleanString(record.tip, MAX_PROSE_LENGTH);

	const goalCallouts = Array.isArray(record.goal_callouts)
		? record.goal_callouts
				.map(cleanCallout)
				.filter(Boolean)
				.slice(0, MAX_CALLOUTS)
		: [];
	const debtCallouts = Array.isArray(record.debt_callouts)
		? record.debt_callouts
				.map(cleanCallout)
				.filter(Boolean)
				.slice(0, MAX_CALLOUTS)
		: [];

	// At minimum a usable tip (or review) is required to count as a success.
	if (!review && !tip) return null;

	return {
		review,
		observation,
		tip,
		goal_callouts: goalCallouts,
		debt_callouts: debtCallouts,
	};
}

/**
 * Try to parse a JSON object out of a model response: first the whole
 * string, then slices starting at each `{` from the end backwards. Handles
 * chain-of-thought prefixes and trailing commentary without trusting them.
 */
function extractJsonObject(text: string): unknown | null {
	try {
		return JSON.parse(text);
	} catch {
		// fall through to slice-based extraction
	}

	let idx = text.lastIndexOf("{");
	while (idx !== -1) {
		const slice = text.slice(idx);
		try {
			const parsed = JSON.parse(slice);
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				return parsed;
			}
		} catch {
			// try the next candidate
		}
		idx = text.lastIndexOf("{", idx - 1);
	}
	return null;
}

function renderAtAGlance(stats: DigestStats): string {
	const top = stats.topCategories[0];
	const lines = [
		`- **Income:** ${stats.money(stats.income)} (${stats.incomeCount} ${stats.incomeCount === 1 ? "transaction" : "transactions"})`,
		`- **Expenses:** ${stats.money(stats.expenses)} (${stats.expenseCount} ${stats.expenseCount === 1 ? "transaction" : "transactions"})`,
		`- **Net:** ${stats.money(stats.net)}`,
		top
			? `- **Top category:** ${top.name} (${stats.money(top.amount)})`
			: "- **Top category:** none",
	];
	return `## At a Glance\n${lines.join("\n")}`;
}

function renderTopSpending(stats: DigestStats, observation: string): string {
	const bullets = stats.topCategories
		.slice(0, 5)
		.map(
			(c) =>
				`- **${c.name}** — ${stats.money(c.amount)} (${c.percent.toFixed(1)}% of spending)`,
		);
	const obs = observation
		? `Observation: ${observation}`
		: "Observation: review your top categories to spot opportunities.";
	return `## Top Spending\n${bullets.join("\n") || "- No expenses recorded."}\n${obs}`;
}

function renderBudgetCheck(stats: DigestStats): string {
	if (stats.budgets.length === 0) return "";
	const bullets = stats.budgets.map((b) => {
		const status =
			b.status === "over"
				? "over budget"
				: b.status === "at risk"
					? "at risk"
					: "on track";
		return `- **${b.category}:** ${stats.money(b.spent)} / ${stats.money(b.limit)} (${b.percent.toFixed(0)}%) — ${status}`;
	});
	return `## Budget Check\n${bullets.join("\n")}`;
}

function renderGoalsAndDebt(stats: DigestStats, prose: DigestProse): string {
	const goalLines = stats.goals.map((g) => {
		const base = `- **${g.name}:** ${stats.money(g.current)} / ${stats.money(g.target)} (${g.percent.toFixed(0)}% complete)`;
		const callout = prose.goal_callouts.find((c) => c.length > 0);
		return callout ? `${base} — ${callout}` : base;
	});
	const debtLines = stats.debts.map((d) => {
		const base = `- **${d.name}:** ${stats.money(d.balance)} remaining at ${d.rate}% interest`;
		const callout = prose.debt_callouts.find((c) => c.length > 0);
		return callout ? `${base} — ${callout}` : base;
	});
	const lines = [...goalLines, ...debtLines];
	if (lines.length === 0) return "";
	return `## Goals & Debt\n${lines.join("\n")}`;
}

/**
 * Render the digest markdown from server-computed stats + model prose.
 * Sections with no data are omitted; the Tip is a blockquote callout.
 */
export function renderDigestMarkdown(
	stats: DigestStats,
	prose: DigestProse,
): string {
	const sections = [
		renderAtAGlance(stats),
		`## Week in Review\n${
			prose.review ||
			`This week you earned ${stats.money(stats.income)} and spent ${stats.money(
				stats.expenses,
			)}, for a net ${stats.net >= 0 ? "savings" : "outflow"} of ${stats.money(stats.net)}.`
		}`,
		renderTopSpending(stats, prose.observation),
		renderBudgetCheck(stats),
		renderGoalsAndDebt(stats, prose),
		prose.tip
			? `## Tip\n> ${prose.tip}`
			: `## Tip\n> Track your spending against a small weekly budget and review your top categories.`,
	];

	return sections.filter(Boolean).join("\n\n");
}
