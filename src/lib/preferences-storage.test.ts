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

  test("keeps a valid accent and drops an invalid one", () => {
    expect(sanitizePreferences({ accent: "navy" })).toEqual({ accent: "navy" });
    expect(sanitizePreferences({ accent: "violet" })).toEqual({ accent: "violet" });
    expect(sanitizePreferences({ accent: "cyan" })).toEqual({ accent: "cyan" });
    expect(sanitizePreferences({ accent: "rose" })).toEqual({ accent: "rose" });
    expect(sanitizePreferences({ accent: "amber" })).toEqual({ accent: "amber" });

    const tampered = sanitizePreferences({ accent: "pink-polka-dot" });
    expect(tampered).toEqual({});
  });

  test("leaves accent absent when not present (no implicit reset to default)", () => {
    const result = normalizePreferences({ currency: "USD" });
    expect(result.accent).toBeUndefined();
  });

  test("persists hideBalances and defaults it to false", () => {
    expect(normalizePreferences({ hideBalances: true }).hideBalances).toBe(true);
    expect(normalizePreferences({}).hideBalances).toBe(false);
  });

  test("drops the retired notification flags rather than persisting them", () => {
    // The Alerts tab wrote these but nothing ever read them. Keeping them in the
    // allow-list would silently re-persist dead settings from old DB rows.
    const result = sanitizePreferences({
      notifications: true,
      emailAlerts: true,
      budgetAlerts: true,
    });
    expect(result).toEqual({});
  });

  test("defaults to a day-first date format to match the default INR currency", () => {
    expect(normalizePreferences({}).dateFormat).toBe("dd/MM/yyyy");
  });
});
