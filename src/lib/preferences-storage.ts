import { defaultPreferences, type Preferences } from "@/types/preferences";
import { ACCENT_OPTIONS, type AccentName } from "@/components/system/themes";

const STRING_FIELDS = ["currency", "dateFormat", "kilocodeModel"] as const;
const BOOLEAN_FIELDS = [
  "notifications",
  "emailAlerts",
  "budgetAlerts",
  "kilocodeApiKeyConfigured",
] as const;

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
