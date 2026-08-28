import { getAuthedUserId } from "../_services/auth.service.js";
import { query } from "../_repositories/db.js";
import {
	generateWithProvider,
	KiloCodeApiError,
	MissingApiKeyError,
} from "../_services/_ai_ai-provider.js";
import { resolveAiPreferences } from "../_services/ai-preferences.service.js";
import { parseTransactionExtractionJson } from "../_domain/ai-parse.js";
import type { ApiRequest, ApiResponse } from "../_utils/types.js";
import { sendApiError } from "../_utils/respond.js";

interface CategoryRow {
	id: string;
	name: string;
	type: string;
}

interface AccountRow {
	id: string;
	name: string;
	type: string;
	is_active: boolean;
}

/**
 * Natural-language transaction entry: `POST /api/ai/parse-transaction`.
 *
 * The model is given the user's actual categories and accounts (with ids) and
 * asked to extract transaction fields as strict JSON. Everything the model
 * returns is validated server-side: ids must belong to the user, amounts must
 * be positive numbers, dates must be real calendar dates. Nothing is written
 * to the database — the client shows the parsed result in the transaction
 * dialog for confirmation before saving.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
	const userId = await getAuthedUserId(req);
	if (!userId) {
		res.status(401).json({ error: "Unauthorized" });
		return;
	}

	if (req.method !== "POST") {
		res.status(405).json({ error: "Method not allowed" });
		return;
	}

	try {
		const { message, aiPreferences } = req.body || {};
		if (!message || typeof message !== "string" || !message.trim()) {
			res.status(400).json({ error: "Message is required" });
			return;
		}
		const trimmed = message.trim();
		if (trimmed.length > 500) {
			res
				.status(400)
				.json({ error: "Message is too long (max 500 characters)" });
			return;
		}

		const { prefs, currency, hasKey, providerLabel } =
			await resolveAiPreferences(
				userId,
				typeof aiPreferences === "object" &&
					aiPreferences !== null &&
					!Array.isArray(aiPreferences)
					? (aiPreferences as Record<string, unknown>)
					: undefined,
			);

		if (!hasKey) {
			res.status(400).json({
				error: `${providerLabel} API key not set in preferences. Please add your API key in Settings > Preferences > AI Integration.`,
			});
			return;
		}

		const [{ rows: categories }, { rows: accounts }] = await Promise.all([
			query<CategoryRow>(
				"SELECT id, name, type FROM categories WHERE user_id = $1",
				[userId],
			),
			query<AccountRow>(
				"SELECT id, name, type, is_active FROM accounts WHERE user_id = $1",
				[userId],
			),
		]);

		const activeAccounts = (accounts || []).filter((a) => a.is_active);
		const categoryList = (categories || [])
			.map((c) => `${c.name} (${c.type})`)
			.join(", ");
		const accountList = activeAccounts.map((a) => a.name).join(", ");
		const today = new Date();
		const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

		const prompt = `
You are a financial data-entry assistant. Extract a single transaction from the user's natural-language instruction.

**Instruction:** "${trimmed}"

**Available categories** (use these EXACT names, or null if none fits):
${categoryList || "(none — user has no categories yet)"}

**Available accounts** (use these EXACT names, or null if none fits):
${accountList || "(none — user has no accounts yet)"}

**Rules:**
1. Return ONLY a JSON object, no markdown, no commentary:
{"type": "income" | "expense" | "transfer", "amount": 45.5, "description": "short label", "category_name": "Groceries" | null, "account_name": "Checking" | null, "to_account_name": "Savings" | null, "date": "YYYY-MM-DD"}
2. "amount" is a positive number (no currency symbols).
3. "date" defaults to today (${todayIso}); interpret words like "yesterday", "last friday", "on the 3rd" as the actual calendar date. Never invent a date the user did not imply.
4. Use the EXACT category and account names from the lists above. If the user mentions something not in the lists, return null for that field (never invent names).
5. A transfer needs both "account_name" (from) and "to_account_name" (to); otherwise use "expense" or "income".
6. "description" is a concise label (e.g. "Groceries", "Salary"), 3-8 words.
7. Never include extra keys.
`;

		const response = await generateWithProvider(
			prompt,
			prefs,
			{
				responseMimeType: "application/json",
			},
			req.signal,
		);

		const parsed = parseTransactionExtractionJson(response);
		if (!parsed) {
			res.status(422).json({
				error:
					'Could not understand that as a transaction. Try something like: "Paid $45 for groceries yesterday" or "Salary of $2,000 on the 1st".',
			});
			return;
		}

		// Resolve names → ids, verifying ownership against the user's own data.
		const categoryById = new Map((categories || []).map((c) => [c.id, c]));
		const categoryByName = new Map(
			(categories || []).map((c) => [c.name.toLowerCase(), c]),
		);
		const accountById = new Map(activeAccounts.map((a) => [a.id, a]));
		const accountByName = new Map(
			activeAccounts.map((a) => [a.name.toLowerCase(), a]),
		);

		const resolveCategory = (id: string | null, name: string | null) => {
			if (id && categoryById.has(id)) return categoryById.get(id)!;
			if (name) {
				const match = categoryByName.get(name.toLowerCase());
				if (match) return match;
			}
			return null;
		};
		const resolveAccount = (id: string | null, name: string | null) => {
			if (id && accountById.has(id)) return accountById.get(id)!;
			if (name) {
				const match = accountByName.get(name.toLowerCase());
				if (match) return match;
			}
			return null;
		};

		const category = resolveCategory(parsed.category_id, parsed.category_name);
		const account = resolveAccount(parsed.account_id, parsed.account_name);
		const toAccount =
			parsed.type === "transfer"
				? resolveAccount(parsed.to_account_id, parsed.to_account_name)
				: null;

		if (parsed.type === "transfer" && (!account || !toAccount) && activeAccounts.length > 0) {
			res.status(422).json({
				error:
					"Transfers require both source and destination accounts. Available accounts: " + accountList,
			});
			return;
		}

		res.status(200).json({
			parsed: {
				type: parsed.type,
				amount: parsed.amount,
				description: parsed.description,
				date: parsed.date,
				category_id: category?.id ?? null,
				account_id: account?.id ?? null,
				to_account_id: toAccount?.id ?? null,
				currency,
			},
		});
	} catch (error) {
		console.error("AI parse-transaction error:", error);

		if (error instanceof MissingApiKeyError) {
			res.status(400).json({ error: error.message });
		} else if (error instanceof KiloCodeApiError) {
			const status =
				Number.isInteger(error.status) &&
				error.status >= 400 &&
				error.status <= 599
					? error.status
					: 502;
			res.status(status).json({ error: error.message });
		} else {
			sendApiError(res, error);
		}
	}
}
