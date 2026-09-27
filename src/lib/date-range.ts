/**
 * Canonical YYYY-MM-DD extraction for transaction dates.
 *
 * Postgres `DATE` columns arrive as `YYYY-MM-DD` strings, but a JSON API or a
 * driver can hand back a `Date` or a full ISO timestamp. Comparing those
 * naively is how a transaction ends up filed under the wrong month.
 *
 * The trap: `String(date).split("T")[0]` works for a string but is the
 * UTC-parse path for a `Date` — `String(new Date("2026-09-01"))` yields
 * "Mon Sep 01 2026", which contains no "T" at all, so `split("T")[0]` returns
 * the entire string and every comparison silently misbehaves. Six call sites
 * used that idiom (Dashboard ×3, useFinancialHealth ×2, Calendar ×1) while
 * `parseTransactionDate` in `@/lib/date-utils` already existed precisely to
 * avoid it.
 *
 * `toDateKey` returns the LOCAL calendar day, which is what a user means by
 * "which month was this in".
 */
export function toDateKey(value: string | Date | null | undefined): string {
	if (value == null) return "";

	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return "";
		const year = value.getFullYear();
		const month = String(value.getMonth() + 1).padStart(2, "0");
		const day = String(value.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	// A date-only string is already the key; do not re-parse it as UTC.
	const trimmed = value.trim();
	const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
	if (dateOnly) return dateOnly[1];

	// Fall back to a local-date parse for anything else.
	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) return "";
	const year = parsed.getFullYear();
	const month = String(parsed.getMonth() + 1).padStart(2, "0");
	const day = String(parsed.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** `YYYY-MM` bucket for a transaction date, in local time. */
export function toMonthKey(value: string | Date | null | undefined): string {
	return toDateKey(value).slice(0, 7);
}

/** True when the date falls in the inclusive `[start, end]` YYYY-MM-DD range. */
export function isDateInRange(
	value: string | Date | null | undefined,
	start: string,
	end?: string,
): boolean {
	const key = toDateKey(value);
	if (!key) return false;
	return key >= start && (end === undefined || key <= end);
}

/**
 * Savings rate as a PERCENTAGE, signed.
 *
 * This was computed three times with two different units and two different
 * clamps:
 *
 *   Dashboard       `((income - expenses) / income) * 100`  → %, can be negative
 *   Reports         `net / income` rounded                  → %, can be negative
 *   useFinancialHealth `Math.max(0, (income - expenses) / income)` → RATIO, clamped
 *
 * So an overspending user saw a negative rate on the Dashboard and in Reports
 * but 0% on the health card — and because the health card then multiplied the
 * clamped 0 by 100, "0% savings" scored identically to exactly break-even,
 * which is harsher than either percentage.
 *
 * One definition now: a signed percentage. The health hook converts to a
 * 0..100 score with an explicit, documented clamp.
 */
export function savingsRatePercent(income: number, expenses: number): number {
	if (!(income > 0)) return 0;
	return ((income - expenses) / income) * 100;
}

/**
 * 0..100 health-score contribution for a savings rate.
 *
 * Distinct from `savingsRatePercent`: a negative rate (overspending) floors at
 * 0 here, because there is no such thing as a negative "savings health" score.
 */
export function savingsScoreFromPercent(percent: number): number {
	return Math.max(0, Math.min(100, percent));
}
