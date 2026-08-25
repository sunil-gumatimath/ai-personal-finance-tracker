import { ValidationError } from "../_errors/AppError.js";
import {
  assertEnum,
  assertIsoDateString,
  assertNumberInRange,
  assertOptionalBoundedString,
  assertPositiveNumber,
  assertRequiredString,
} from "./common.js";

/** Sane ceiling for money amounts (DECIMAL(15,2) columns). */
const MAX_AMOUNT = 1_000_000_000_000;

const DEBT_TYPES = [
  "mortgage",
  "car_loan",
  "student_loan",
  "personal_loan",
  "credit_card",
  "medical",
  "other",
] as const;

function assertAmount(value: unknown, message: string) {
  assertNumberInRange(value, 0.01, MAX_AMOUNT, message);
}

/** Non-negative optional amount (principal portions, minimum payments…). */
function assertNonNegativeAmount(value: unknown, message: string) {
  if (value === undefined || value === null) return;
  assertNumberInRange(value, 0, MAX_AMOUNT, message);
}

export function validateCreateDebtInput(data: Record<string, unknown>) {
  assertRequiredString(data.name, "Debt name is required");
  assertPositiveNumber(data.original_amount, "Valid original amount is required");
}

export function validateUpdateDebtInput(data: Record<string, unknown>) {
  if ("name" in data) assertRequiredString(data.name, "Debt name is required");
  if ("type" in data && data.type !== undefined) {
    assertEnum(data.type, DEBT_TYPES, "Valid debt type is required");
  }
  if ("original_amount" in data && data.original_amount !== undefined) {
    assertAmount(
      data.original_amount,
      "Valid original amount is required",
    );
  }
  if ("current_balance" in data && data.current_balance !== undefined) {
    assertNumberInRange(
      data.current_balance,
      0,
      MAX_AMOUNT,
      "Current balance must be a non-negative number",
    );
  }
  if ("interest_rate" in data && data.interest_rate !== undefined) {
    assertNumberInRange(
      data.interest_rate,
      0,
      100,
      "Interest rate must be between 0 and 100",
    );
  }
  if ("minimum_payment" in data && data.minimum_payment !== undefined) {
    assertNonNegativeAmount(
      data.minimum_payment,
      "Minimum payment must be a non-negative number",
    );
  }
  if ("due_day" in data && data.due_day !== undefined && data.due_day !== null) {
    assertNumberInRange(
      data.due_day,
      1,
      31,
      "Due day must be between 1 and 31",
    );
  }
  if ("start_date" in data) {
    assertIsoDateString(data.start_date, "Invalid start date format. Use YYYY-MM-DD");
  }
  if ("end_date" in data) {
    assertIsoDateString(data.end_date, "Invalid end date format. Use YYYY-MM-DD");
  }
  if ("lender" in data) {
    assertOptionalBoundedString(
      data.lender,
      100,
      "Lender must be at most 100 characters",
    );
  }
  if ("notes" in data) {
    assertOptionalBoundedString(
      data.notes,
      2000,
      "Notes must be at most 2000 characters",
    );
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
 * Payment amounts must line up with the DB CHECKs: amount > 0, principal and
 * interest each >= 0, and principal + interest <= total amount.
 */
export function validateCreateDebtPaymentInput(data: Record<string, unknown>) {
  assertRequiredString(data.debt_id, "Debt ID is required");
  assertAmount(data.amount, "Valid payment amount is required");

  const principal = data.principal_amount;
  const interest = data.interest_amount;
  if (principal !== undefined && principal !== null) {
    assertNonNegativeAmount(
      principal,
      "Principal amount must be a non-negative number",
    );
  }
  if (interest !== undefined && interest !== null) {
    assertNonNegativeAmount(
      interest,
      "Interest amount must be a non-negative number",
    );
  }
  if (
    typeof principal === "number" &&
    typeof interest === "number" &&
    principal + interest > (data.amount as number)
  ) {
    throw new ValidationError(
      "Principal plus interest cannot exceed the payment amount",
    );
  }

  if ("payment_date" in data && data.payment_date !== undefined && data.payment_date !== null) {
    assertIsoDateString(
      data.payment_date,
      "Invalid payment date format. Use YYYY-MM-DD",
    );
  }
  if ("notes" in data) {
    assertOptionalBoundedString(
      data.notes,
      500,
      "Notes must be at most 500 characters",
    );
  }
}
