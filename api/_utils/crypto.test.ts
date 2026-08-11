import { describe, expect, test } from "bun:test";
import { sanitizePreferencesForClient } from "./crypto";

describe("server preference sanitization", () => {
  test("replaces decrypted provider keys with configured flags", () => {
    const result = sanitizePreferencesForClient({
      currency: "USD",
      kilocodeApiKey: "kilo-secret-key",
    });

    expect(result).not.toBeNull();
    if (!result) throw new Error("Expected sanitized preferences");
    expect(result.kilocodeApiKey).toBeUndefined();
    expect(result.kilocodeApiKeyConfigured).toBe(true);
  });
});
