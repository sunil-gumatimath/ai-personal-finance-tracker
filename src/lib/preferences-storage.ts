import {
	defaultPreferences,
	isSupportedCurrency,
	type Preferences,
} from "@/types/preferences";
import { ACCENT_OPTIONS, type AccentName } from "@/components/system/themes";

const STRING_FIELDS = ["dateFormat", "kilocodeModel"] as const;
// `notifications` / `emailAlerts` / `budgetAlerts` were removed: nothing in the
// app read them (no push service, no mail sender, no client call to
// /api/notifications), so the Alerts tab only wrote unread booleans to the DB.
const BOOLEAN_FIELDS = ["hideBalances", "kilocodeApiKeyConfigured"] as const;

const ACCENT_VALUES = new Set<string>(ACCENT_OPTIONS.map(({ value }) => value));

export function sanitizePreferences(value: unknown): Partial<Preferences> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const input = value as Record<string, unknown>;
  const sanitized: Partial<Preferences> = {};

  for (const field of STRING_FIELDS) {
    if (typeof input[field] === "string") {
      (sanitized as Record<string, unknown>)[field] = input[field];
    }
  }

  // Currency is validated rather than merely type-checked. An unsupported code
  // makes `Intl.NumberFormat` throw during render, so a stale, tampered, or
  // cross-tab value must fall back to the default instead of reaching a
  // formatter. `dateFormat` needs no such guard: `patternFor` in
  // `@/lib/format-date` falls back to a safe default for unknown values.
  if (isSupportedCurrency(input.currency)) {
    sanitized.currency = input.currency;
  }

  for (const field of BOOLEAN_FIELDS) {
    if (typeof input[field] === "boolean") {
      (sanitized as Record<string, unknown>)[field] = input[field];
    }
  }

  if (input.aiProvider === "kilocode") {
    sanitized.aiProvider = input.aiProvider;
  }

  // Only accept known accent values; strip anything else (incl. tampered data).
  if (typeof input.accent === "string" && ACCENT_VALUES.has(input.accent)) {
    sanitized.accent = input.accent as AccentName;
  }

  return sanitized;
}

export function normalizePreferences(value: unknown): Preferences {
  return { ...defaultPreferences, ...sanitizePreferences(value) };
}
