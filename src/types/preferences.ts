import { DEFAULT_AI_MODEL } from "@/lib/ai-models";
import type { AccentName } from "@/components/system/themes";

export interface Preferences {
	currency: string;
	/**
	 * Display order for dates, consumed exclusively by `@/lib/format-date`.
	 * Kept as the raw pattern string so existing saved values stay valid.
	 */
	dateFormat: string;
	/**
	 * Hide monetary figures across the app until explicitly revealed. Persisted
	 * (and synced) because a per-page React `useState` was reset by the route
	 * remount in MainLayout, silently un-hiding balances on every navigation.
	 */
	hideBalances: boolean;
	aiProvider?: "kilocode";
	kilocodeApiKeyConfigured: boolean;
	kilocodeModel?: string;
	/**
	 * UI accent. Optional + absent until the user picks one, so devices that
	 * have never chosen an accent keep their local choice instead of being
	 * reset to "default" on sync.
	 *
	 * The values are the internal ids from `ACCENT_OPTIONS` — note `amber` is
	 * labelled "Sunset" in the UI. Read the label from ACCENT_OPTIONS rather
	 * than inferring a colour name from this value.
	 */
	accent?: AccentName;
}

export const PREFERENCES_KEY = "financetrack_preferences";

export const defaultPreferences: Preferences = {
	currency: "INR",
	// INR is the default currency and en-IN uses day-first ordering, so the
	// default date format follows suit. Previously this was MM/dd/yyyy, which
	// shipped US ordering to every new user.
	dateFormat: "dd/MM/yyyy",
	hideBalances: false,
	aiProvider: "kilocode",
	kilocodeApiKeyConfigured: false,
	kilocodeModel: DEFAULT_AI_MODEL,
};

export const currencySymbols: Record<string, string> = {
	USD: "$",
	EUR: "€",
	GBP: "£",
	INR: "₹",
	JPY: "¥",
};

export const currencyLocales: Record<string, string> = {
	USD: "en-US",
	EUR: "de-DE",
	GBP: "en-GB",
	INR: "en-IN",
	JPY: "ja-JP",
};

/**
 * The set of currencies the app can actually render, derived from
 * `currencyLocales` so the two can never drift.
 *
 * This is the client-side half of the validation the server also performs
 * (`api/_routes/profile.routes.ts`). Persisted preferences can pre-date a
 * change, be tampered with, or arrive from a `storage` event, so the client
 * must not trust a stored currency string blindly: an unrecognised code makes
 * `Intl.NumberFormat` throw a `RangeError` *during render*, which the
 * ErrorBoundary turns into a blank authenticated app.
 */
export const SUPPORTED_CURRENCIES = Object.keys(currencyLocales);

export function isSupportedCurrency(value: unknown): value is string {
	return typeof value === "string" && SUPPORTED_CURRENCIES.includes(value);
}
