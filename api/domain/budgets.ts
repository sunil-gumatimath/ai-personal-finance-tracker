import { assertEnum, assertPositiveNumber, assertRequiredString } from "./common.js";

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
