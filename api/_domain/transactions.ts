import { ValidationError } from "../_errors/AppError.js";
export { assertUuid } from "./common.js";

export type TransactionType = "income" | "expense" | "transfer";

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type TransactionInput = Record<string, unknown>;

export type TransactionListOptions = {
	since?: string;
	limit?: number | null;
};

const VALID_TRANSACTION_TYPES = new Set<TransactionType>([
	"income",
	"expense",
	"transfer",
]);

const VALID_RECURRING_FREQUENCIES = new Set<RecurringFrequency>([
	"daily",
	"weekly",
	"monthly",
	"yearly",
]);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseTransactionType(value: unknown): TransactionType {
	if (
		typeof value !== "string" ||
		!VALID_TRANSACTION_TYPES.has(value as TransactionType)
	) {
		throw new ValidationError(
			"Valid transaction type is required (income, expense, transfer)",
		);
	}
	return value as TransactionType;
}

export function assertPositiveAmount(value: unknown) {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		throw new ValidationError("Valid amount is required");
	}
}

export function validateCreateTransactionInput(data: TransactionInput) {
	parseTransactionType(data.type);
	assertPositiveAmount(data.amount);
}

export function validateListTransactionsOptions(
	options: TransactionListOptions,
) {
	if (options.since && !DATE_REGEX.test(options.since)) {
		throw new ValidationError("Invalid date format. Use YYYY-MM-DD");
	}
}

export function normalizeTransactionLimit(limit: unknown): number | null {
	if (typeof limit !== "string" || limit.trim() === "") return null;
	const parsed = parseInt(limit, 10);
	return parsed > 0 && parsed <= 1000 ? parsed : null;
}

// ---------------------------------------------------------------------------
// Recurring transaction support
// ---------------------------------------------------------------------------

/** Formats a Date as YYYY-MM-DD in LOCAL time (never UTC-shifted). */
function formatDateLocal(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/**
 * Advance a date by one frequency interval. Monthly intervals clamp to the
 * last day of the target month (Jan 31 + 1 month = Feb 28/29), matching how
 * real billers schedule month-end recurrences.
 */
export function computeNextDueDate(
	date: string,
	frequency: RecurringFrequency,
): string {
	const [y, m, d] = date.split("-").map(Number);
	if (!y || !m || !d) {
		throw new ValidationError("Invalid date format. Use YYYY-MM-DD");
	}
	const base = new Date(y, m - 1, d);
	switch (frequency) {
		case "daily":
			base.setDate(base.getDate() + 1);
			break;
		case "weekly":
			base.setDate(base.getDate() + 7);
			break;
		case "monthly": {
			const targetDay = base.getDate();
			base.setDate(1);
			base.setMonth(base.getMonth() + 1);
			const lastDay = new Date(
				base.getFullYear(),
				base.getMonth() + 1,
				0,
			).getDate();
			base.setDate(Math.min(targetDay, lastDay));
			break;
		}
		case "yearly": {
			const targetDay = base.getDate();
			const targetMonth = base.getMonth();
			const nextYear = base.getFullYear() + 1;
			// Clamp Feb 29 → Feb 28 when the next year is not a leap year.
			const lastDay = new Date(nextYear, targetMonth + 1, 0).getDate();
			base.setFullYear(nextYear, targetMonth, Math.min(targetDay, lastDay));
			break;
		}
	}
	return formatDateLocal(base);
}

/** True when `value` is a plausible YYYY-MM-DD calendar date. */
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

function assertRecurringFrequency(value: unknown): RecurringFrequency {
	if (
		typeof value !== "string" ||
		!VALID_RECURRING_FREQUENCIES.has(value as RecurringFrequency)
	) {
		throw new ValidationError(
			"Valid recurring frequency is required (daily, weekly, monthly, yearly)",
		);
	}
	return value as RecurringFrequency;
}

/**
 * Normalize recurring fields before persisting. Server-owned fields
 * (`next_due_date`, `recurring_parent_id`) are stripped from client input;
 * `next_due_date` is recomputed from `date` + `recurring_frequency`.
 *
 * On updates, a series that has already advanced is never rewound: if the
 * recomputed due date would land before the stored one, the stored one wins
 * (prevents re-generating occurrences that were already materialized).
 */
export function sanitizeRecurringInput(
	data: TransactionInput,
	existing?: Record<string, unknown> | null,
): TransactionInput {
	const out = { ...data };
	// Server-owned — never accepted from the client.
	delete out.next_due_date;
	delete out.recurring_parent_id;

	const isRecurring =
		typeof out.is_recurring === "boolean"
			? out.is_recurring
			: existing?.is_recurring === true;

	if (!isRecurring) {
		// Only clear fields when the flag itself changed; a partial update
		// (e.g. editing just the description) must not wipe the schedule.
		if (typeof out.is_recurring === "boolean") {
			out.is_recurring = false;
			out.recurring_frequency = null;
			out.recurring_end_date = null;
		}
		out.next_due_date = null;
		return out;
	}

	if (!out.is_recurring) out.is_recurring = true;

	const frequency = assertRecurringFrequency(
		out.recurring_frequency ?? (existing ? "monthly" : undefined),
	);
	out.recurring_frequency = frequency;

	if (out.recurring_end_date !== undefined && out.recurring_end_date !== null) {
		const endDate = out.recurring_end_date;
		if (!isDateString(endDate)) {
			throw new ValidationError("Invalid end date format. Use YYYY-MM-DD");
		}
		const baseDate = typeof out.date === "string" ? out.date : existing?.date;
		if (baseDate && endDate < baseDate) {
			throw new ValidationError(
				"End date must be on or after the transaction date",
			);
		}
	}

	const existingDate =
		existing && typeof existing.date === "string" ? existing.date : undefined;
	const baseDate = typeof out.date === "string" ? out.date : existingDate;
	const computed = baseDate ? computeNextDueDate(baseDate, frequency) : null;
	if (computed) {
		// Never rewind an advanced series (occurrences may already exist).
		const storedDue =
			existing?.is_recurring && existing?.next_due_date
				? existing.next_due_date
				: null;
		out.next_due_date =
			storedDue && computed < storedDue ? storedDue : computed;
	} else {
		out.next_due_date = null;
	}

	return out;
}
