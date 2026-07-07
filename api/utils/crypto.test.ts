import { describe, expect, test } from "bun:test";
import { sanitizePreferencesForClient } from "./crypto";

describe("server preference sanitization", () => {
  test("replaces decrypted provider keys with configured flags", () => {
    const result = sanitizePreferencesForClient({
      currency: "USD",
      geminiApiKey: "AIza-secret",
      openrouterApiKey: "",
    });

    expect(result).not.toBeNull();
    if (!result) throw new Error("Expected sanitized preferences");
    expect(result.geminiApiKey).toBeUndefined();
    expect(result.openrouterApiKey).toBeUndefined();
    expect(result.geminiApiKeyConfigured).toBe(true);
    expect(result.openrouterApiKeyConfigured).toBe(false);
  });
});
