import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  encryptPreferences,
  decryptPreferences,
  sanitizePreferencesForClient,
} from "./crypto";

// The module reads these at call time, so they can be set per-test.
const ORIGINAL_SECRET = process.env.API_KEY_ENCRYPTION_SECRET;
const ORIGINAL_AUTH_SECRET = process.env.AUTH_SECRET;
const ORIGINAL_MOCK = process.env.USE_MOCK_DB;
const ORIGINAL_ENV = process.env.NODE_ENV;

function setSecret(value: string | undefined): void {
  if (value === undefined) delete process.env.API_KEY_ENCRYPTION_SECRET;
  else process.env.API_KEY_ENCRYPTION_SECRET = value;
  delete process.env.AUTH_SECRET;
}

beforeEach(() => {
  setSecret("test-encryption-secret-that-is-long-enough");
  process.env.USE_MOCK_DB = "false";
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.API_KEY_ENCRYPTION_SECRET;
  else process.env.API_KEY_ENCRYPTION_SECRET = ORIGINAL_SECRET;
  if (ORIGINAL_AUTH_SECRET === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = ORIGINAL_AUTH_SECRET;
  if (ORIGINAL_MOCK === undefined) delete process.env.USE_MOCK_DB;
  else process.env.USE_MOCK_DB = ORIGINAL_MOCK;
  process.env.NODE_ENV = ORIGINAL_ENV;
});

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

  test("reports an unconfigured key when none is stored", () => {
    const result = sanitizePreferencesForClient({ currency: "USD" });
    expect(result?.kilocodeApiKeyConfigured).toBe(false);
  });

  test("handles a null preferences blob", () => {
    expect(sanitizePreferencesForClient(null)).toBeNull();
  });
});

describe("API key encryption round-trip", () => {
  // These exercise the AES-256-GCM path end to end. It previously had no
  // coverage at all, which left the double-encryption guard and the
  // authenticated-decryption behaviour unverified.

  test("round-trips a key so the stored value never contains the plaintext", () => {
    const secret = "kilo-live-abcdef0123456789";
    const encrypted = encryptPreferences({ kilocodeApiKey: secret, currency: "INR" });

    expect(encrypted?.kilocodeApiKey).toBeDefined();
    expect(encrypted?.kilocodeApiKey).not.toBe(secret);
    expect(String(encrypted?.kilocodeApiKey)).toMatch(/^enc:aes256gcm:/);

    const decrypted = decryptPreferences(encrypted);
    expect(decrypted?.kilocodeApiKey).toBe(secret);
    // Non-key fields pass through untouched.
    expect(decrypted?.currency).toBe("INR");
  });

  test("produces a distinct ciphertext each time (random IV)", () => {
    const secret = "same-key";
    const a = encryptPreferences({ kilocodeApiKey: secret })?.kilocodeApiKey;
    const b = encryptPreferences({ kilocodeApiKey: secret })?.kilocodeApiKey;
    expect(a).not.toBe(b);
    expect(decryptPreferences({ kilocodeApiKey: a })?.kilocodeApiKey).toBe(secret);
    expect(decryptPreferences({ kilocodeApiKey: b })?.kilocodeApiKey).toBe(secret);
  });

  test("is not idempotently re-encrypted", () => {
    // `encryptPreferences` must not double-wrap an already-encrypted value,
    // or repeated saves would nest prefixes until decryption failed.
    const once = encryptPreferences({ kilocodeApiKey: "secret-key" });
    const twice = encryptPreferences(once);
    expect(String(twice?.kilocodeApiKey).match(/enc:aes256gcm:/g)?.length).toBe(1);
    expect(decryptPreferences(twice)?.kilocodeApiKey).toBe("secret-key");
  });

  test("rejects a tampered ciphertext rather than returning garbage", () => {
    const encrypted = encryptPreferences({ kilocodeApiKey: "secret-key" });
    const stored = String(encrypted?.kilocodeApiKey);
    // Flip a character in the ciphertext body; GCM's auth tag must catch it.
    const parts = stored.replace("enc:aes256gcm:", "").split(":");
    const body = parts[2] ?? "";
    const flipped = body.length > 2
      ? `${body[0] === "a" ? "b" : "a"}${body.slice(1)}`
      : `${body}a`;
    parts[2] = flipped;
    const tampered = `enc:aes256gcm:${parts.join(":")}`;

    expect(() => decryptPreferences({ kilocodeApiKey: tampered })).toThrow();
  });

  test("leaves the demo and test keys in plaintext by design", () => {
    // `demo-key` and `test-real-key*` are deliberate non-secrets the demo mode
    // relies on; they must round-trip unchanged rather than being encrypted.
    for (const passthrough of ["demo-key", "test-real-key-abc"]) {
      const result = encryptPreferences({ kilocodeApiKey: passthrough });
      expect(result?.kilocodeApiKey).toBe(passthrough);
      expect(decryptPreferences(result)?.kilocodeApiKey).toBe(passthrough);
    }
  });

  test("treats an empty or whitespace-only key as absent", () => {
    expect(encryptPreferences({ kilocodeApiKey: "" })?.kilocodeApiKey).toBe("");
    // Whitespace is normalised away rather than stored verbatim, so a stray
    // space can neither be encrypted nor read back as a configured key.
    expect(encryptPreferences({ kilocodeApiKey: "   " })?.kilocodeApiKey).toBe("");
    expect(
      sanitizePreferencesForClient({ kilocodeApiKey: "   " })
        ?.kilocodeApiKeyConfigured,
    ).toBe(false);
  });

  test("passes through a null preferences blob", () => {
    expect(encryptPreferences(null)).toBeNull();
    expect(decryptPreferences(null)).toBeNull();
  });

  test("leaves a non-string key untouched", () => {
    const prefs = { kilocodeApiKey: 42 } as unknown as Record<string, unknown>;
    expect(encryptPreferences(prefs)?.kilocodeApiKey).toBe(42);
  });
});
