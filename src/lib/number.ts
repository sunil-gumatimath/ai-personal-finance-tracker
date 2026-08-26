/**
 * Shared defensive coercion for money fields.
 *
 * PostgreSQL DECIMAL columns may come back as `number` OR as a numeric
 * `string` depending on the driver/serialization path, so every consumer
 * should funnel raw row values through this helper before doing math.
 */
export function toNumber(value: number | string | null | undefined): number {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const parsed = parseFloat(value);
		return Number.isNaN(parsed) ? 0 : parsed;
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
 */
export function formatCompactCurrency(
	value: number,
	currency: string,
	locale = "en-US",
	maximumFractionDigits = 1,
): string {
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
