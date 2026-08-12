/**
 * Pure domain logic for the natural-language transaction entry feature —
 * strict, defensive parsing of the JSON blob returned by the LLM. Never
 * trusts the model: any field that fails validation is dropped (or the whole
 * parse is rejected when the shape is unusable).
 */

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
}

const VALID_TYPES = new Set<ParsedTransactionType>([
	"income",
	"expense",
	"transfer",
]);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isDateString(value: unknown): value is string {
	if (typeof value !== "string" || !DATE_REGEX.test(value)) return false;
	const [y, m, d] = value.split("-").map(Number);
	const date = new Date(y, m - 1, d);
	return (
		date.getFullYear() === y &&
		date.getMonth() === m - 1 &&
		date.getDate() === d
	);
}

function cleanString(value: unknown, maxLength: number): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, maxLength);
}

/** The AI may return amounts as strings ("$45.50") — coerce defensively. */
function parseAmount(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return Math.round(value * 100) / 100;
	}
	if (typeof value === "string") {
		const cleaned = value.replace(/[^0-9.-]/g, "");
		const parsed = Number(cleaned);
		if (Number.isFinite(parsed) && parsed > 0) {
			return Math.round(parsed * 100) / 100;
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

	if (!type || amount === null || !date) return null;
	if (
		type === "transfer" &&
		(!accountId || !toAccountId || accountId === toAccountId)
	) {
		return null;
	}

	return {
		type,
		amount,
		description: cleanString(record.description, 500),
		date,
		category_id: type === "transfer" ? null : categoryId,
		account_id: accountId,
		to_account_id: type === "transfer" ? toAccountId : null,
		category_name: cleanString(record.category_name, 100),
		account_name: cleanString(record.account_name, 100),
	};
}
