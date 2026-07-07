import { assertPositiveNumber, assertRequiredString } from "./common.js";

export function validateCreateDebtInput(data: Record<string, unknown>) {
  assertRequiredString(data.name, "Debt name is required");
  assertPositiveNumber(data.original_amount, "Valid original amount is required");
}

export function validateCreateDebtPaymentInput(data: Record<string, unknown>) {
  assertRequiredString(data.debt_id, "Debt ID is required");
  assertPositiveNumber(data.amount, "Valid payment amount is required");
}
