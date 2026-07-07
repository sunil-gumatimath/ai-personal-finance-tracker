import { assertRequiredString } from "./common.js";

export function validateCreateAccountInput(data: Record<string, unknown>) {
  assertRequiredString(data.name, "Account name is required");
  assertRequiredString(data.type, "Account type is required");
}
