import { ValidationError } from "../_errors/AppError.js";
import {
  assertCurrencyCode,
  assertEnum,
  assertOptionalBoundedString,
  assertRequiredString,
  MAX_MONEY_AMOUNT,
} from "./common.js";

/**
 * Max length for an account name. Declared here so the domain performs the
 * check itself; `_query-builder.ts` MAX_LENGTHS keeps a matching entry as a
 * second line of defence.
 */
export const MAX_ACCOUNT_NAME_LENGTH = 100;

const ACCOUNT_TYPES = [

  "checking",
  "savings",
  "credit",
  "investment",
  "cash",
  "other",
] as const;

/**
 * Account balances may legitimately be negative — a credit card is an
 * obligation, and the UI says so explicitly ("Use a negative balance for what
 * you owe") and derives `totalLiabilities` from negative balances.
 *
 * Create and update previously disagreed: create never inspected `balance` at
 * all (so any value, including a wildly out-of-range one, was persisted), while
 * update rejected negatives with `min = 0`. That made credit-card balances
 * settable only at creation time, and produced a 400 for a value the product
 * explicitly supports.
 */
function assertBalance(value: unknown): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError("Balance must be a finite number");
  }
  if (Math.abs(value) > MAX_MONEY_AMOUNT) {
    throw new ValidationError("Balance must be a finite number");
  }
}

export function validateCreateAccountInput(data: Record<string, unknown>) {
  assertRequiredString(data.name, "Account name is required");
  // The real length limit lived only in `_query-builder.ts` MAX_LENGTHS, two
  // layers down, so the domain advertised validation it did not perform and a
  // 101-character name reached the database before being rejected.
  assertOptionalBoundedString(
    data.name,
    MAX_ACCOUNT_NAME_LENGTH,
    `Account name must be at most ${MAX_ACCOUNT_NAME_LENGTH} characters`,
  );
  assertEnum(data.type, ACCOUNT_TYPES, "Valid account type is required");
  if ("balance" in data && data.balance !== undefined) {
    assertBalance(data.balance);
  }
  if ("currency" in data && data.currency !== undefined) {
    assertCurrencyCode(data.currency, "Invalid currency code (expected e.g. USD)");
  }
  if ("color" in data) {
    assertOptionalBoundedString(data.color, 32, "Invalid color value");
  }
  if ("icon" in data) {
    assertOptionalBoundedString(data.icon, 64, "Invalid icon value");
  }
  if ("is_active" in data && typeof data.is_active !== "boolean") {
    throw new ValidationError("is_active must be a boolean");
  }
}

/**
 * Partial update semantics: only validate the keys that are present, but
 * validate those strictly so bad values never reach Postgres.
 */
export function validateUpdateAccountInput(data: Record<string, unknown>) {
  if ("name" in data) {
    assertRequiredString(data.name, "Account name is required");
    assertOptionalBoundedString(
      data.name,
      MAX_ACCOUNT_NAME_LENGTH,
      `Account name must be at most ${MAX_ACCOUNT_NAME_LENGTH} characters`,
    );
  }
  if ("type" in data && data.type !== undefined) {
    assertEnum(data.type, ACCOUNT_TYPES, "Valid account type is required");
  }
  if ("balance" in data && data.balance !== undefined) {
    assertBalance(data.balance);
  }
  if ("currency" in data && data.currency !== undefined) {
    assertCurrencyCode(data.currency, "Invalid currency code (expected e.g. USD)");
  }
  if ("color" in data) {
    assertOptionalBoundedString(data.color, 32, "Invalid color value");
  }
  if ("icon" in data) {
    assertOptionalBoundedString(data.icon, 64, "Invalid icon value");
  }
  if ("is_active" in data && typeof data.is_active !== "boolean") {
    throw new ValidationError("is_active must be a boolean");
  }
}
