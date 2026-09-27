import { ValidationError } from "../_errors/AppError.js";
import {
  assertEnum,
  assertIsoDateString,
  assertMoneyAmount,
  assertRequiredString,
} from "./common.js";

export type BudgetPeriod = "weekly" | "monthly" | "yearly";

export function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `end_date` must not precede `start_date`; the DB CHECK only catches it as a 500. */
function assertDateOrder(
  start: unknown,
  end: unknown,
): void {
  if (typeof start === "string" && typeof end === "string" && end < start) {
    throw new ValidationError("End date must not be before the start date");
  }
}

export function validateCreateBudgetInput(data: Record<string, unknown>) {
  assertRequiredString(data.category_id, "Category is required");
  // `assertPositiveNumber` had no ceiling, so a value beyond DECIMAL(15,2)
  // reached Postgres and surfaced as a 500. Note `start_date` is NOT NULL in
  // the schema with no default, so it must be required here rather than
  // surfacing as a not_null_violation.
  assertMoneyAmount(data.amount, "Valid budget amount is required");
  assertEnum(
    data.period,
    ["weekly", "monthly", "yearly"] as const,
    "Valid period is required (weekly, monthly, yearly)",
  );
  if (data.start_date !== undefined && data.start_date !== null) {
    assertIsoDateString(data.start_date, "Invalid start date format. Use YYYY-MM-DD");
  }
  if (data.end_date !== undefined && data.end_date !== null) {
    assertIsoDateString(data.end_date, "Invalid end date format. Use YYYY-MM-DD");
  }
  assertDateOrder(data.start_date, data.end_date);
}

/**
 * Partial update semantics: only validate the keys that are present, but
 * validate those strictly so bad values never reach Postgres.
 */
export function validateUpdateBudgetInput(
  data: Record<string, unknown>,
  existing?: Record<string, unknown>,
) {
  if ("category_id" in data && data.category_id !== undefined) {
    assertRequiredString(data.category_id, "Category is required");
  }
  if ("amount" in data && data.amount !== undefined) {
    assertMoneyAmount(data.amount, "Valid budget amount is required");
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
  assertDateOrder(
    "start_date" in data ? data.start_date : existing?.start_date,
    "end_date" in data ? data.end_date : existing?.end_date,
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

export interface BudgetWindow {
  /** Inclusive lower bound (YYYY-MM-DD). */
  start: string;
  /** Inclusive upper bound (YYYY-MM-DD). */
  end: string;
}

/**
 * The single definition of "spend counted against this budget".
 *
 * This function replaces four independent implementations that had drifted
 * into disagreeing answers for the same user on the same day:
 *
 *  - `budgets.service`   — period start only; no upper bound, ignored
 *                         `start_date` / `end_date`
 *  - `digest.service`    — correct period logic, also no upper bound
 *  - `notifications`     — `CURRENT_DATE - 1 month` for *every* period,
 *                         including weekly and yearly
 *  - `useFinancialHealth`— one month of spend compared against the raw budget
 *                         amount, ignoring `period` and the server's `spent`
 *
 * A weekly ₹500 grocery budget checked on a Sunday with ₹300 spent on Friday
 * reported ₹0 on the Budgets page, ₹300 in the digest, and ₹300 in
 * notifications. The health score, which is 30% weighted, was the worst of the
 * lot because it compared a month of spending to a weekly limit.
 *
 * Three rules, all of which the old versions got wrong:
 *
 *  1. **Lower bound is the period start**, but never earlier than the budget's
 *     own `start_date` — a budget that begins in December must not accumulate
 *     September spending.
 *  2. **Upper bound is today.** Nothing is capped at the end of its period, and
 *     nothing rejects future dates (that would break scheduling and recurring
 *     entries), so without this an expense dated next month inflated *this*
 *     month's spend and reported a phantom overspend.
 *  3. **`end_date` caps both ends.** An expired budget stops accruing spend and
 *     is treated as zero rather than as permanently "on track".
 */
export function getBudgetWindow(
  budget: {
    period: BudgetPeriod | string;
    start_date?: string | null;
    end_date?: string | null;
  },
  now = new Date(),
): BudgetWindow {
  const period = (
    budget.period === "weekly" || budget.period === "yearly" ? budget.period : "monthly"
  ) as BudgetPeriod;

  const today = toDateString(now);
  const periodStart = getBudgetPeriodStartDate(period, now);

  let start = periodStart;
  if (budget.start_date && budget.start_date > start) {
    start = budget.start_date;
  }

  // Never accrue spend beyond the budget's own end, and never beyond today.
  let end = today;
  if (budget.end_date && budget.end_date < end) {
    end = budget.end_date;
  }

  // An expired or not-yet-started budget has an empty window. Represent it as
  // an inverted range so every `<= date <=` filter yields nothing.
  if (end < start) {
    return { start, end: "" };
  }

  return { start, end };
}

/** True when a transaction date falls inside the budget's window. */
export function isDateInBudgetWindow(date: string, window: BudgetWindow): boolean {
  if (!window.end) return false;
  return date >= window.start && date <= window.end;
}
