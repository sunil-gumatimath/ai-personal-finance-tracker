import { NotFoundError, ValidationError } from "../errors/AppError.js";
import { assertUuid } from "../domain/common.js";
import {
  getBudgetPeriodStartDate,
  toDateString,
  validateCreateBudgetInput,
} from "../domain/budgets.js";
import { assertBudgetReferencesOwned } from "./ownership.service.js";
import {
  createBudget,
  deleteBudget,
  findBudgetById,
  listBudgets,
  listExpenseTransactionsSince,
  updateBudget,
  type BudgetRow,
} from "../repositories/budgets.repository.js";

export async function listUserBudgets(userId: string) {
  const now = new Date();
  const earliestStartDate = toDateString(new Date(now.getFullYear(), 0, 1));

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
    const startDateStr = getBudgetPeriodStartDate(budget.period, now);
    const categoryTransactions = transactionsByCategory.get(budget.category_id) || [];
    const spent = categoryTransactions
      .filter((transaction) => transaction.date >= startDateStr)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return { ...budget, spent };
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

  await assertBudgetReferencesOwned(userId, data, existing);
  const budget = await updateBudget(userId, id, data);
  if (!budget) throw new ValidationError("No valid fields to update");
  return budget;
}

export async function deleteUserBudget(userId: string, id: string) {
  assertUuid(id, "budget ID");
  await deleteBudget(userId, id);
}
