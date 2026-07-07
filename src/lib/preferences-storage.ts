import { defaultPreferences, type Preferences } from "@/types/preferences";

const STRING_FIELDS = ["currency", "dateFormat", "geminiModel", "openrouterModel"] as const;
const BOOLEAN_FIELDS = [
  "notifications",
  "emailAlerts",
  "budgetAlerts",
  "geminiApiKeyConfigured",
  "openrouterApiKeyConfigured",
] as const;

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

  if (input.aiProvider === "gemini" || input.aiProvider === "openrouter") {
    sanitized.aiProvider = input.aiProvider;
  }

  return sanitized;
}

export function normalizePreferences(value: unknown): Preferences {
  return { ...defaultPreferences, ...sanitizePreferences(value) };
}
