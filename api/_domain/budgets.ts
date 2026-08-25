import { assertEnum, assertIsoDateString, assertPositiveNumber, assertRequiredString } from "./common.js";

export type BudgetPeriod = "weekly" | "monthly" | "yearly";

export function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function validateCreateBudgetInput(data: Record<string, unknown>) {
  assertRequiredString(data.category_id, "Category is required");
  assertPositiveNumber(data.amount, "Valid budget amount is required");
  assertEnum(
    data.period,
    ["weekly", "monthly", "yearly"] as const,
    "Valid period is required (weekly, monthly, yearly)",
  );
}

/**
 * Partial update semantics: only validate the keys that are present, but
 * validate those strictly so bad values never reach Postgres.
 */
export function validateUpdateBudgetInput(data: Record<string, unknown>) {
  if ("category_id" in data && data.category_id !== undefined) {
    assertRequiredString(data.category_id, "Category is required");
  }
  if ("amount" in data && data.amount !== undefined) {
    assertPositiveNumber(data.amount, "Valid budget amount is required");
  }
  if ("period" in data && data.period !== undefined) {
    assertEnum(
      data.period,
      ["weekly", "monthly", "yearly"] as const,
      "Valid period is required (weekly, monthly, yearly)",
    );
  }
  if ("start_date" in data) {
    assertIsoDateString(data.start_date, "Invalid start date format. Use YYYY-MM-DD");
  }
  if ("end_date" in data) {
    assertIsoDateString(data.end_date, "Invalid end date format. Use YYYY-MM-DD");
  }
}

export function getBudgetPeriodStartDate(period: BudgetPeriod, now = new Date()) {
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  switch (period) {
    case "weekly":
      return toDateString(startOfWeek);
    case "yearly":
      return toDateString(new Date(now.getFullYear(), 0, 1));
    default:
      return toDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  }
}
