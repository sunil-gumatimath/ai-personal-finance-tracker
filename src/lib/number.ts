/**
 * Placeholder rendered in place of a monetary amount while the `hideBalances`
 * privacy switch is on. Defined here so every formatter (full, compact, and
 * server-side) uses the same mask.
 */
export const HIDDEN_AMOUNT = "••••••";

/**
 * Strict numeric-string shape for a money value: optional sign, digits with at
 * most one decimal point, at most two decimal places, no exponent, no
 * thousands separators, no currency symbols, no stray characters.
 *
 * The previous implementation used a bare `parseFloat`, which silently returns
 * a *wrong but plausible* number for anything non-canonical: `"1,234.56"` → 1,
 * `"$45.00"` → 0, `"12.5%"` → 12.5. On a money field a silent 1000x error is
 * worse than a rejected value, so unparseable input now normalises to 0 and
 * anything a caller sends on the wire is rejected upstream by validation.
 */
const PLAIN_DECIMAL = /^[+-]?(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/;

export function toNumber(value: number | string | null | undefined): number {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed === "") return 0;
		// Tolerate a leading "+" and a bare ".5", but nothing else non-canonical.
		const candidate = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
		if (!PLAIN_DECIMAL.test(candidate)) return 0;
		const parsed = Number(candidate);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

/**
 * Returns the currency symbol (e.g. "$", "€") for a currency code.
 */
export function getCurrencySymbol(currency: string, locale = "en-US"): string {
	try {
		const parts = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0);
		return parts.find((p) => p.type === "currency")?.value ?? "$";
	} catch {
		return "$";
	}
}

/**
 * Compact, currency-aware axis/chip formatting (e.g. "$5k", "€1.2k").
 * Use for chart tick formatters and dense surfaces like calendar cells —
 * anywhere full `formatCurrency` output is too wide.
 *
 * `hidden` must be threaded through for the balance-privacy switch to reach
 * charts. It used to take no visibility argument at all, which is why every
 * chart axis leaked real amounts no matter what the toggle said.
 */
export function formatCompactCurrency(
	value: number,
	currency: string,
	locale = "en-US",
	maximumFractionDigits = 1,
	hidden = false,
): string {
	if (hidden) return HIDDEN_AMOUNT;
	try {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
			notation: "compact",
			maximumFractionDigits,
		}).format(value);
	} catch {
		return `${value.toExponential(1)}`;
	}
}
