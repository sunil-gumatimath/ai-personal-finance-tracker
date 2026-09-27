import { NotFoundError, ValidationError } from "../_errors/AppError.js";
import { assertUuid } from "../_domain/common.js";
import {
  getBudgetWindow,
  isDateInBudgetWindow,
  toDateString,
  validateCreateBudgetInput,
  validateUpdateBudgetInput,
} from "../_domain/budgets.js";
import { assertBudgetReferencesOwned } from "./ownership.service.js";
import {
  createBudget,
  deleteBudget,
  findBudgetById,
  listBudgets,
  listExpenseTransactionsSince,
  updateBudget,
  type BudgetRow,
} from "../_repositories/budgets.repository.js";

export async function listUserBudgets(userId: string) {
  const now = new Date();
  // Fetch a little extra history so a budget whose own `start_date` predates
  // this calendar year still has transactions to sum.
  const earliestStartDate = toDateString(new Date(now.getFullYear() - 1, 0, 1));

  const [budgets, transactions] = await Promise.all([
    listBudgets(userId),
    listExpenseTransactionsSince(userId, earliestStartDate),
  ]);

  const transactionsByCategory = new Map<string, { amount: number; date: string }[]>();
  for (const transaction of transactions) {
    if (!transaction.category_id) continue;
    const existing = transactionsByCategory.get(transaction.category_id) || [];
    existing.push({ amount: transaction.amount, date: transaction.date });
    transactionsByCategory.set(transaction.category_id, existing);
  }

  return budgets.map((budget: BudgetRow) => {
    // One shared definition of the counting window, so this page, the AI
    // digest, notifications and the financial-health score can no longer
    // report four different numbers for the same budget on the same day.
    const window = getBudgetWindow(
      {
        period: budget.period,
        start_date: (budget.start_date as string | null) ?? null,
        end_date: (budget.end_date as string | null) ?? null,
      },
      now,
    );
    const categoryTransactions = transactionsByCategory.get(budget.category_id) || [];
    const spent = categoryTransactions
      .filter((transaction) => isDateInBudgetWindow(transaction.date, window))
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return {
      ...budget,
      spent,
      period_start: window.start,
      period_end: window.end,
    };
  });
}

export async function createUserBudget(userId: string, data: Record<string, unknown>) {
  validateCreateBudgetInput(data);
  await assertBudgetReferencesOwned(userId, data);

  const budget = await createBudget(userId, data);
  if (!budget) throw new Error("Budget creation failed");
  return budget;
}

export async function updateUserBudget(
  userId: string,
  id: string,
  data: Record<string, unknown>,
) {
  assertUuid(id, "budget ID");
  const existing = await findBudgetById(userId, id);
  if (!existing) throw new NotFoundError("Budget not found");

  // Validated against the post-update row so a patch that only moves
  // `end_date` before the stored `start_date` is a 400, not a DB CHECK 500.
  validateUpdateBudgetInput(data, existing);

  await assertBudgetReferencesOwned(userId, data, existing);
  const budget = await updateBudget(userId, id, data);
  if (!budget) throw new ValidationError("No valid fields to update");
  return budget;
}

export async function deleteUserBudget(userId: string, id: string) {
  assertUuid(id, "budget ID");
  await deleteBudget(userId, id);
}
