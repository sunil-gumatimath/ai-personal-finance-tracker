import {
  assertEnum,
  assertOptionalBoundedString,
  assertRequiredString,
} from "./common.js";

/** Max length enforced here AND in `_query-builder.ts` MAX_LENGTHS. */
export const MAX_CATEGORY_NAME_LENGTH = 100;

export function validateCategoryType(value: unknown) {
  assertEnum(
    value,
    ["income", "expense"] as const,
    "Valid category type is required (income, expense)",
  );
}

export function validateCreateCategoryInput(data: Record<string, unknown>) {
  assertRequiredString(data.name, "Category name is required");
  assertOptionalBoundedString(
    data.name,
    MAX_CATEGORY_NAME_LENGTH,
    `Category name must be at most ${MAX_CATEGORY_NAME_LENGTH} characters`,
  );
  validateCategoryType(data.type);
}

/**
 * Partial update semantics.
 *
 * This function did not exist. `updateUserCategory` called no validator at
 * all, which meant:
 *
 *  - `type` was unchecked by the domain, so only the DB CHECK caught a bad
 *    value — surfacing as a 500 rather than a 400.
 *  - `parent_id` was accepted with no cycle check. `parent_id` carries
 *    `ON DELETE SET NULL` and nothing else guards it, so
 *    `PUT {"parent_id": "<own id>"}` succeeded, as did creating a longer cycle
 *    (A -> B -> A). Any recursive tree render then loops forever, and a
 *    recursive CTE walk overflows the stack.
 *  - `name` length was bounded only in the repository layer, so the domain
 *    claimed to validate while the real limit lived two layers down.
 */
export function validateUpdateCategoryInput(data: Record<string, unknown>) {
  if ("name" in data && data.name !== undefined) {
    assertRequiredString(data.name, "Category name is required");
    assertOptionalBoundedString(
      data.name,
      MAX_CATEGORY_NAME_LENGTH,
      `Category name must be at most ${MAX_CATEGORY_NAME_LENGTH} characters`,
    );
  }
  if ("type" in data && data.type !== undefined) {
    validateCategoryType(data.type);
  }
  if ("color" in data) {
    assertOptionalBoundedString(data.color, 32, "Invalid color value");
  }
  if ("icon" in data) {
    assertOptionalBoundedString(data.icon, 64, "Invalid icon value");
  }
}
