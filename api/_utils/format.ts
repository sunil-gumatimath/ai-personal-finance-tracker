/**
 * Shared money formatting helpers.
 *
 * Previously duplicated (with slight drift) in ai-chat.routes.ts,
 * ai-insights.routes.ts, and digest.service.ts — keep them in one place so
 * every AI surface formats currency identically.
 */

const CURRENCY_LOCALES: Record<string, string> = {
	USD: "en-US",
	INR: "en-IN",
	EUR: "de-DE",
	GBP: "en-GB",
	JPY: "ja-JP",
};

// Cache Intl.NumberFormat instances — constructing one per call is wasteful
// inside prompt-building loops.
const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, currency: string): Intl.NumberFormat {
	const key = `${locale}:${currency}`;
	let formatter = formatterCache.get(key);
	if (!formatter) {
		formatter = new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
		});
		formatterCache.set(key, formatter);
	}
	return formatter;
}

/**
 * Format an amount as a currency string using the locale conventionally
 * paired with the currency code. Falls back to a plain `$` amount when the
 * code is unknown or Intl rejects it (e.g. a made-up code).
 */
export function formatCurrency(amount: number, currency: string): string {
	try {
		return getFormatter(CURRENCY_LOCALES[currency] || "en-US", currency).format(
			amount,
		);
	} catch {
		return `$${amount.toFixed(2)}`;
	}
}
