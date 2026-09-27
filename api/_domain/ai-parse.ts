/**
 * Pure domain logic for the natural-language transaction entry feature —
 * strict, defensive parsing of the JSON blob returned by the LLM. Never
 * trusts the model: any field that fails validation is dropped (or the whole
 * parse is rejected when the shape is unusable).
 */

import { isCalendarDateString } from "./common.js";

type ParsedTransactionType = "income" | "expense" | "transfer";

export interface ParsedTransaction {
	type: ParsedTransactionType;
	amount: number;
	description: string | null;
	date: string;
	category_id: string | null;
	account_id: string | null;
	to_account_id: string | null;
	/** Best-effort name hints from the model, for the client to display. */
	category_name: string | null;
	account_name: string | null;
	to_account_name: string | null;
}

const VALID_TYPES = new Set<ParsedTransactionType>([
	"income",
	"expense",
	"transfer",
]);

// Delegates to the one calendar-date implementation in `_domain/common.ts`.
// This file previously carried a byte-identical copy (and a THIRD existed in
// `_domain/transactions.ts`), so a fix to the date rules had to be applied three
// times. `assertIsoDateString` now uses the shared version too.
function isDateString(value: unknown): value is string {
	return isCalendarDateString(value);
}

function cleanString(value: unknown, maxLength: number): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, maxLength);
}

/**
 * The AI may return amounts as strings ("$45.50") — coerce defensively.
 *
 * The positivity check is re-applied AFTER rounding. It used to be checked only
 * on the pre-rounding value while the rounded value was returned, so `0.001`
 * and `"0.004"` both produced `0` — not `null`. The caller only tests
 * `amount === null`, so the route answered 200 with `amount: 0`, violating this
 * function's own `> 0` contract, and the dialog prefilled "0" for a request
 * the server had declared valid.
 *
 * The string branch also no longer strips characters that change magnitude.
 * `replace(/[^0-9.-]/g, "")` turned `"1e5"` into `15` (a 6,667× understatement)
 * and `"1.5e3"` into `1.53`. Exponent notation is rejected outright instead,
 * which is the honest answer for an amount a model produced.
 */
function parseAmount(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		const rounded = Math.round(value * 100) / 100;
		return rounded > 0 ? rounded : null;
	}
	if (typeof value === "string") {
		// Tolerate a leading currency symbol and thousands separators, which a
		// model legitimately emits. Reject anything else rather than stripping
		// it, because stripping can silently change the number.
		const cleaned = value
			.trim()
			.replace(/^[₹$€£¥]\s*/, "")
			.replace(/,(?=\d{3}\b)/g, "");
		if (!/^\+?(?:\d+(?:\.\d+)?|\.\d+)$/.test(cleaned)) return null;
		const parsed = Number(cleaned);
		if (Number.isFinite(parsed) && parsed > 0) {
			const rounded = Math.round(parsed * 100) / 100;
			return rounded > 0 ? rounded : null;
		}
	}
	return null;
}

/**
 * Parse the model's JSON into a validated ParsedTransaction.
 * Returns null when the response is not usable (missing type/amount/date).
 */
export function parseTransactionExtractionJson(
	raw: string,
): ParsedTransaction | null {
	if (!raw || typeof raw !== "string") return null;

	const cleaned = raw
		.replace(/```json/gi, "")
		.replace(/```/g, "")
		.trim();
	if (!cleaned) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(cleaned);
	} catch {
		return null;
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return null;
	}
	const record = parsed as Record<string, unknown>;

	const type =
		typeof record.type === "string" &&
		VALID_TYPES.has(record.type as ParsedTransactionType)
			? (record.type as ParsedTransactionType)
			: null;
	const amount = parseAmount(record.amount);
	const date =
		typeof record.date === "string" && isDateString(record.date)
			? record.date
			: null;

	// A transfer is only usable when both sides were provided and distinct.
	const categoryId = cleanString(record.category_id, 64);
	const accountId = cleanString(record.account_id, 64);
	const toAccountId = cleanString(record.to_account_id, 64);
	const categoryName = cleanString(record.category_name, 100);
	const accountName = cleanString(record.account_name, 100);
	const toAccountName = cleanString(record.to_account_name, 100);

	if (!type || amount === null || !date) return null;
	if (type === "transfer") {
		const fromSpecified = Boolean(accountId || accountName);
		const toSpecified = Boolean(toAccountId || toAccountName);
		if (!fromSpecified || !toSpecified) return null;
		if (accountId && toAccountId && accountId === toAccountId) return null;
		if (
			accountName &&
			toAccountName &&
			accountName.toLowerCase() === toAccountName.toLowerCase()
		) {
			return null;
		}
	}

	return {
		type,
		amount,
		description: cleanString(record.description, 500),
		date,
		category_id: type === "transfer" ? null : categoryId,
		account_id: accountId,
		to_account_id: type === "transfer" ? toAccountId : null,
		category_name: categoryName,
		account_name: accountName,
		to_account_name: type === "transfer" ? toAccountName : null,
	};
}
