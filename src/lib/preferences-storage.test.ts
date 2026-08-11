import { describe, expect, test } from "bun:test";
import { normalizePreferences, sanitizePreferences } from "./preferences-storage";

describe("preferences storage sanitization", () => {
  test("drops provider API keys before preferences are stored in the browser", () => {
    const result = sanitizePreferences({
      currency: "USD",
      aiProvider: "kilocode",
      kilocodeApiKey: "kilo-secret",
      kilocodeApiKeyConfigured: true,
    });

    expect(result).toEqual({
      currency: "USD",
      aiProvider: "kilocode",
      kilocodeApiKeyConfigured: true,
    });
  });

  test("normalizes invalid provider values back to safe defaults", () => {
    const result = normalizePreferences({
      aiProvider: "unknown",
      kilocodeApiKeyConfigured: true,
    });

    expect(result.aiProvider).toBe("kilocode");
    expect(result.kilocodeApiKeyConfigured).toBe(true);
  });
});
