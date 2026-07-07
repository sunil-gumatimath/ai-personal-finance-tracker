import { describe, expect, test } from "bun:test";
import { ValidationError } from "../errors/AppError";
import { validateCreateAccountInput } from "./accounts";
import { getBudgetPeriodStartDate, validateCreateBudgetInput } from "./budgets";
import { validateCreateCategoryInput, validateCategoryType } from "./categories";
import { validateCreateDebtInput, validateCreateDebtPaymentInput } from "./debts";
import { validateCreateGoalInput } from "./goals";

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
