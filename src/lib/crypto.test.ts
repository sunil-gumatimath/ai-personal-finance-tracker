import { expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "./crypto";

test("hashPassword returns a string with $pbkdf2$ prefix", async () => {
    const password = "mysecretpassword";
    const hash = await hashPassword(password);
    expect(hash.startsWith("$pbkdf2$")).toBe(true);
});

test("verifyPassword returns true for correct password", async () => {
    const password = "mysecretpassword";
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
});

test("verifyPassword returns false for incorrect password", async () => {
    const password = "mysecretpassword";
    const hash = await hashPassword(password);
    const isValid = await verifyPassword("wrongpassword", hash);
    expect(isValid).toBe(false);
});

test("verifyPassword returns false for invalid hash format", async () => {
    const isValid = await verifyPassword("password", "invalidhash");
    expect(isValid).toBe(false);
});

test("verifyPassword returns false for plaintext mismatch", async () => {
    // This function expects a hash, but if we pass something that doesn't start with $pbkdf2$, it returns false
    const isValid = await verifyPassword("password", "plaintextpassword");
    expect(isValid).toBe(false);
});

test("Multiple hashes of same password should be different (salting)", async () => {
    const password = "samepassword";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);

    // But both should verify correctly
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
});
