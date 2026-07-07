import { describe, expect, test } from "bun:test";
import { normalizePreferences, sanitizePreferences } from "./preferences-storage";

describe("preferences storage sanitization", () => {
  test("drops provider API keys before preferences are stored in the browser", () => {
    const result = sanitizePreferences({
      currency: "USD",
      aiProvider: "gemini",
      geminiApiKey: "AIza-secret",
      openrouterApiKey: "sk-or-secret",
      geminiApiKeyConfigured: true,
    });

    expect(result).toEqual({
      currency: "USD",
      aiProvider: "gemini",
      geminiApiKeyConfigured: true,
    });
  });

  test("normalizes invalid provider values back to safe defaults", () => {
    const result = normalizePreferences({
      aiProvider: "unknown",
      openrouterApiKeyConfigured: true,
    });

    expect(result.aiProvider).toBe("gemini");
    expect(result.openrouterApiKeyConfigured).toBe(true);
  });
});
