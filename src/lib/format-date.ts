import { format } from "date-fns";
import { currencyLocales, type Preferences } from "@/types/preferences";

/**
 * Single consumer for the user's `dateFormat` preference.
 *
 * Every date in the app used to be rendered with either
 * `date-fns` `format(d, "MMM d, yyyy")` (fixed US ordering) or a bare
 * `toLocaleDateString()` (browser locale), so the Date Format control in
 * Settings saved a value nothing ever read. These helpers are the one place
 * that honours it.
 */

/** `dd/MM/yyyy` → `d/M/yyyy`, so single-digit days are not zero-padded twice. */
function patternFor(pref: string): string {
	switch (pref) {
		case "dd/MM/yyyy":
			return "d/M/yyyy";
		case "yyyy-MM-dd":
			return "yyyy-MM-dd";
		case "MM/dd/yyyy":
		default:
			return "M/d/yyyy";
	}
}

/**
 * Full date, e.g. `26/9/2026` or `2026-09-26`, per the user's preference.
 * Month names are intentionally omitted so the chosen field order stays
 * visible and the output is unambiguous regardless of locale.
 */
export function formatUserDate(
	date: Date,
	preferences: Pick<Preferences, "dateFormat">,
): string {
	if (Number.isNaN(date.getTime())) return "—";
	return format(date, patternFor(preferences.dateFormat));
}

/**
 * Compact date for dense surfaces (list rows, calendar cells), e.g. `26/9`.
 * Uses the same field order as {@link formatUserDate}.
 */
export function formatUserDateShort(
	date: Date,
	preferences: Pick<Preferences, "dateFormat">,
): string {
	if (Number.isNaN(date.getTime())) return "—";
	// Drop ONLY the trailing year, keeping the separator that precedes it.
	//
	// A blanket `.replace("yyyy", "")` on the full pattern produced "d/M/" for
	// `dd/MM/yyyy` and "M/d/" for `MM/dd/yyyy`, so every short date rendered as
	// "26/9/" — with a trailing slash. It went unnoticed only because the
	// function had no call sites.
	const pattern = patternFor(preferences.dateFormat).replace(/yyyy/, "").trimEnd();
	// A pattern that loses the year needs a year to be unambiguous about which
	// century it refers to; fall back to the full form rather than emit a
	// separator with no value after it.
	return /[a-zA-Z]/.test(pattern) ? format(date, patternFor(preferences.dateFormat)) : format(date, pattern);
}

/**
 * Long, human date for prose contexts ("Generated Sep 26, 2026 at 1:04 AM").
 * Month names read better here than numeric fields, and these strings are
 * narrative rather than tabular, so the numeric pattern does not apply.
 */
export function formatUserDateLong(
	date: Date,
	preferences: Pick<Preferences, "currency">,
): string {
	if (Number.isNaN(date.getTime())) return "—";
	const locale = currencyLocales[preferences.currency] || "en-US";
	return date.toLocaleDateString(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
