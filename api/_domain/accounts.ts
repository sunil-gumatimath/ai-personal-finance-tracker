import { ValidationError } from "../_errors/AppError.js";
import {
  assertCurrencyCode,
  assertEnum,
  assertNumberInRange,
  assertOptionalBoundedString,
  assertRequiredString,
} from "./common.js";

/** Sane ceiling for money amounts (DECIMAL(15,2) columns). */
const MAX_AMOUNT = 1_000_000_000_000;

const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit",
  "investment",
  "cash",
  "other",
] as const;

export function validateCreateAccountInput(data: Record<string, unknown>) {
  assertRequiredString(data.name, "Account name is required");
  assertEnum(data.type, ACCOUNT_TYPES, "Valid account type is required");
}

/**
 * Partial update semantics: only validate the keys that are present, but
 * validate those strictly so bad values never reach Postgres.
 */
export function validateUpdateAccountInput(data: Record<string, unknown>) {
  if ("name" in data) assertRequiredString(data.name, "Account name is required");
  if ("type" in data && data.type !== undefined) {
    assertEnum(data.type, ACCOUNT_TYPES, "Valid account type is required");
  }
  if ("balance" in data && data.balance !== undefined) {
    assertNumberInRange(
      data.balance,
      0,
      MAX_AMOUNT,
      "Balance must be a finite non-negative number",
    );
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
