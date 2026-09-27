import { describe, expect, test } from "bun:test";
import { ValidationError } from "../_errors/AppError";
import { validateCreateAccountInput, validateUpdateAccountInput } from "./accounts";
import {
  getBudgetPeriodStartDate,
  getBudgetWindow,
  isDateInBudgetWindow,
  validateCreateBudgetInput,
  validateUpdateBudgetInput,
} from "./budgets";
import { isCalendarDateString } from "./common";
import { validateCreateCategoryInput, validateCategoryType, validateUpdateCategoryInput } from "./categories";
import { validateCreateDebtInput, validateCreateDebtPaymentInput } from "./debts";
import { validateCreateGoalInput } from "./goals";
import { validateCreateTransactionInput } from "./transactions";

describe("finance resource validation", () => {
  test("validates account creation", () => {
    expect(() => validateCreateAccountInput({ name: "Checking", type: "checking" })).not.toThrow();
    expect(() => validateCreateAccountInput({ name: "", type: "checking" })).toThrow(
      ValidationError,
    );
  });

  test("validates budget creation and period boundaries", () => {
    expect(() =>
      validateCreateBudgetInput({ category_id: "cat", amount: 100, period: "monthly" }),
    ).not.toThrow();
    expect(() =>
      validateCreateBudgetInput({ category_id: "cat", amount: 0, period: "monthly" }),
    ).toThrow(ValidationError);
    expect(getBudgetPeriodStartDate("monthly", new Date("2026-07-07T12:00:00Z"))).toBe(
      "2026-07-01",
    );
  });

  test("validates category creation and filtering", () => {
    expect(() => validateCreateCategoryInput({ name: "Food", type: "expense" })).not.toThrow();
    expect(() => validateCategoryType("invalid")).toThrow(ValidationError);
  });

  test("validates category update, which previously had no validator at all", () => {
    expect(() => validateUpdateCategoryInput({ name: "Food" })).not.toThrow();
    expect(() => validateUpdateCategoryInput({ name: "" })).toThrow(ValidationError);
    // `type` was unchecked, so a bad value reached the DB CHECK and surfaced as
    // a 500 instead of a 400.
    expect(() => validateUpdateCategoryInput({ type: "nonsense" })).toThrow(
      ValidationError,
    );
    expect(() => validateUpdateCategoryInput({ type: "income" })).not.toThrow();
    // The 100-char bound used to live only in the repository layer.
    expect(() => validateUpdateCategoryInput({ name: "x".repeat(101) })).toThrow(
      ValidationError,
    );
    expect(() => validateUpdateCategoryInput({ name: "x".repeat(100) })).not.toThrow();
  });

  test("rejects an over-long account name in the domain", () => {
    expect(() =>
      validateCreateAccountInput({ name: "x".repeat(101), type: "checking" }),
    ).toThrow(ValidationError);
    expect(() =>
      validateCreateAccountInput({ name: "x".repeat(100), type: "checking" }),
    ).not.toThrow();
  });

  test("accepts a negative opening balance for a credit card", () => {
    // The UI documents "use a negative balance for what you owe" and derives
    // totalLiabilities from it, so create must not reject what update allows.
    expect(() =>
      validateCreateAccountInput({ name: "Visa", type: "credit", balance: -500 }),
    ).not.toThrow();
    expect(() =>
      validateUpdateAccountInput({ balance: -600 }),
    ).not.toThrow();
  });

  test("validates debt and debt payment creation", () => {
    expect(() =>
      validateCreateDebtInput({ name: "Loan", original_amount: 1000 }),
    ).not.toThrow();
    expect(() => validateCreateDebtInput({ name: "Loan", original_amount: -1 })).toThrow(
      ValidationError,
    );
    expect(() =>
      validateCreateDebtPaymentInput({ debt_id: "debt", amount: 25 }),
    ).not.toThrow();
  });

  test("validates goal creation", () => {
    expect(() => validateCreateGoalInput({ name: "Emergency", target_amount: 1000 })).not.toThrow();
    expect(() => validateCreateGoalInput({ name: "Emergency", target_amount: 0 })).toThrow(
      ValidationError,
    );
  });
});

describe("calendar date validation", () => {
  test("rejects dates that only match the YYYY-MM-DD shape", () => {
    // These all passed a bare regex and then aborted inside Postgres as
    // `invalid input syntax for type date`, surfacing as a 500.
    expect(isCalendarDateString("2026-02-31")).toBe(false);
    expect(isCalendarDateString("2026-13-01")).toBe(false);
    expect(isCalendarDateString("2026-00-10")).toBe(false);
    expect(isCalendarDateString("2026-04-31")).toBe(false);
    expect(isCalendarDateString("2026-1-1")).toBe(false);
    expect(isCalendarDateString("not-a-date")).toBe(false);
    expect(isCalendarDateString(20260101)).toBe(false);
  });

  test("accepts real calendar dates, including leap days", () => {
    expect(isCalendarDateString("2026-09-27")).toBe(true);
    expect(isCalendarDateString("2024-02-29")).toBe(true); // leap year
    expect(isCalendarDateString("2026-02-28")).toBe(true);
    expect(isCalendarDateString("2026-12-31")).toBe(true);
  });
});

describe("transaction create validation", () => {
  const uuid = "3f333df6-90a4-4fda-8dd3-9485d27cee36";

  test("applies the same strictness as the update path", () => {
    // Create used to check only `type` and `amount`, so all of these reached
    // the database and came back as opaque 500s.
    expect(() =>
      validateCreateTransactionInput({ type: "expense", amount: 10, date: "2026-02-31" }),
    ).toThrow(ValidationError);
    expect(() =>
      validateCreateTransactionInput({ type: "expense", amount: 10, date: "nope" }),
    ).toThrow(ValidationError);
    expect(() =>
      validateCreateTransactionInput({ type: "expense", amount: 1e300 }),
    ).toThrow(ValidationError);
    expect(() =>
      validateCreateTransactionInput({ type: "expense", amount: 10, description: 123 }),
    ).toThrow(ValidationError);
    expect(() =>
      validateCreateTransactionInput({ type: "expense", amount: 10, is_recurring: "yes" }),
    ).toThrow(ValidationError);
  });

  test("enforces the transfer invariant instead of deferring to the DB CHECK", () => {
    expect(() =>
      validateCreateTransactionInput({ type: "transfer", amount: 10, account_id: uuid }),
    ).toThrow(ValidationError); // no destination
    expect(() =>
      validateCreateTransactionInput({
        type: "expense",
        amount: 10,
        account_id: uuid,
        to_account_id: uuid,
      }),
    ).toThrow(ValidationError); // destination on a non-transfer
    expect(() =>
      validateCreateTransactionInput({
        type: "transfer",
        amount: 10,
        account_id: uuid,
        to_account_id: uuid,
      }),
    ).not.toThrow();
  });
});

describe("budget window", () => {
  // 2026-09-27 is a Sunday.
  const now = new Date(2026, 8, 27, 12, 0, 0);

  test("caps the window at today so future spend cannot inflate the period", () => {
    const window = getBudgetWindow({ period: "monthly" }, now);
    expect(window.start).toBe("2026-09-01");
    expect(window.end).toBe("2026-09-27");
    // An expense dated next month belongs to next month.
    expect(isDateInBudgetWindow("2026-10-05", window)).toBe(false);
    expect(isDateInBudgetWindow("2026-09-10", window)).toBe(true);
    expect(isDateInBudgetWindow("2026-09-27", window)).toBe(true);
  });

  test("respects the budget's own start_date over the calendar period", () => {
    const window = getBudgetWindow(
      { period: "monthly", start_date: "2026-12-01" },
      now,
    );
    // Not yet started: the window is empty.
    expect(isDateInBudgetWindow("2026-09-15", window)).toBe(false);
  });

  test("expires a budget whose end_date has passed", () => {
    const window = getBudgetWindow(
      { period: "monthly", end_date: "2026-08-31" },
      now,
    );
    expect(window.end).toBe("");
    expect(isDateInBudgetWindow("2026-09-15", window)).toBe(false);
    expect(isDateInBudgetWindow("2026-08-15", window)).toBe(false);
  });

  test("gives each period its own window", () => {
    expect(getBudgetWindow({ period: "monthly" }, now).start).toBe("2026-09-01");
    expect(getBudgetWindow({ period: "yearly" }, now).start).toBe("2026-01-01");
    // Sunday-start week: on a Sunday the week window is today only.
    expect(getBudgetWindow({ period: "weekly" }, now).start).toBe("2026-09-27");
  });

  test("treats an unknown period as monthly rather than crashing", () => {
    expect(getBudgetWindow({ period: "fortnightly" }, now).start).toBe("2026-09-01");
  });
});

describe("budget amount and date validation", () => {
  test("rejects amounts beyond the DECIMAL(15,2) ceiling", () => {
    // No ceiling existed on either path, so an overflow reached Postgres.
    expect(() =>
      validateCreateBudgetInput({ category_id: "c", amount: 1e300, period: "monthly" }),
    ).toThrow(ValidationError);
    expect(() =>
      validateCreateBudgetInput({
        category_id: "c",
        amount: 1_000_000_000_001,
        period: "monthly",
      }),
    ).toThrow(ValidationError);
  });

  test("rejects an end_date before start_date", () => {
    expect(() =>
      validateCreateBudgetInput({
        category_id: "c",
        amount: 100,
        period: "monthly",
        start_date: "2026-09-01",
        end_date: "2026-08-01",
      }),
    ).toThrow(ValidationError);
  });

  test("validates an update against the stored row", () => {
    expect(() =>
      validateUpdateBudgetInput(
        { end_date: "2026-01-01" },
        { start_date: "2026-09-01", end_date: null },
      ),
    ).toThrow(ValidationError);
  });
});
