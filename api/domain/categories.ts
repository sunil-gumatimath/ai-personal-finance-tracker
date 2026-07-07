import { assertEnum, assertRequiredString } from "./common.js";

export type CategoryType = "income" | "expense";

export function validateCategoryType(value: unknown) {
  assertEnum(
    value,
    ["income", "expense"] as const,
    "Valid category type is required (income, expense)",
  );
}

export function validateCreateCategoryInput(data: Record<string, unknown>) {
  assertRequiredString(data.name, "Category name is required");
  validateCategoryType(data.type);
}
