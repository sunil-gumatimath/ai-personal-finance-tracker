import { describe, expect, test } from "bun:test";
import {
  assertPositiveAmount,
  assertUuid,
  normalizeTransactionLimit,
  validateCreateTransactionInput,
  validateListTransactionsOptions,
} from "./transactions";
import { ValidationError } from "../errors/AppError";

describe("transaction domain validation", () => {
  test("accepts valid transaction create input", () => {
    expect(() =>
      validateCreateTransactionInput({
        type: "expense",
        amount: 12.34,
      }),
    ).not.toThrow();
  });

  test("rejects invalid transaction type", () => {
    expect(() =>
      validateCreateTransactionInput({
        type: "refund",
        amount: 12.34,
      }),
    ).toThrow(ValidationError);
  });

  test("rejects non-positive and non-finite amounts", () => {
    expect(() => assertPositiveAmount(0)).toThrow(ValidationError);
    expect(() => assertPositiveAmount(-1)).toThrow(ValidationError);
    expect(() => assertPositiveAmount(Number.NaN)).toThrow(ValidationError);
  });

  test("validates UUID parameters", () => {
    expect(() =>
      assertUuid("550e8400-e29b-41d4-a716-446655440000", "transaction ID"),
    ).not.toThrow();
    expect(() => assertUuid("not-a-uuid", "transaction ID")).toThrow(ValidationError);
  });

  test("normalizes transaction list limits", () => {
    expect(normalizeTransactionLimit("25")).toBe(25);
    expect(normalizeTransactionLimit("0")).toBeNull();
    expect(normalizeTransactionLimit("1001")).toBeNull();
    expect(normalizeTransactionLimit(undefined)).toBeNull();
  });

  test("rejects invalid since date filters", () => {
    expect(() => validateListTransactionsOptions({ since: "2026-07-07" })).not.toThrow();
    expect(() => validateListTransactionsOptions({ since: "07/07/2026" })).toThrow(
      ValidationError,
    );
  });
});
