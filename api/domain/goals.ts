import { assertPositiveNumber, assertRequiredString } from "./common.js";

export function validateCreateGoalInput(data: Record<string, unknown>) {
  assertRequiredString(data.name, "Goal name is required");
  assertPositiveNumber(data.target_amount, "Valid target amount is required");
}
