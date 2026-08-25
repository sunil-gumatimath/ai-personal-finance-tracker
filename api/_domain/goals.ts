import {
  assertIsoDateString,
  assertNumberInRange,
  assertOptionalBoundedString,
  assertPositiveNumber,
  assertRequiredString,
} from "./common.js";

/** Sane ceiling for money amounts (DECIMAL(15,2) columns). */
const MAX_AMOUNT = 1_000_000_000_000;

export function validateCreateGoalInput(data: Record<string, unknown>) {
  assertRequiredString(data.name, "Goal name is required");
  assertPositiveNumber(data.target_amount, "Valid target amount is required");
}

/**
 * Partial update semantics: only validate the keys that are present, but
 * validate those strictly so bad values never reach Postgres.
 */
export function validateUpdateGoalInput(data: Record<string, unknown>) {
  if ("name" in data) assertRequiredString(data.name, "Goal name is required");
  if ("target_amount" in data && data.target_amount !== undefined) {
    assertNumberInRange(
      data.target_amount,
      0.01,
      MAX_AMOUNT,
      "Valid target amount is required",
    );
  }
  if ("current_amount" in data && data.current_amount !== undefined) {
    assertNumberInRange(
      data.current_amount,
      0,
      MAX_AMOUNT,
      "Current amount must be a finite non-negative number",
    );
  }
  if ("deadline" in data) {
    assertIsoDateString(data.deadline, "Invalid deadline format. Use YYYY-MM-DD");
  }
  if ("color" in data) {
    assertOptionalBoundedString(data.color, 32, "Invalid color value");
  }
  if ("icon" in data) {
    assertOptionalBoundedString(data.icon, 64, "Invalid icon value");
  }
}
