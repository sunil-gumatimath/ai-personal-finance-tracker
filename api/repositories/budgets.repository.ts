import { query } from "../repositories/db.js";
import { buildInsertQuery, buildUpdateQuery } from "../repositories/_query-builder.js";

export type BudgetRow = Record<string, unknown> & {
  id: string;
  period: "weekly" | "monthly" | "yearly";
  category_id: string;
};

export async function findBudgetById(userId: string, id: string) {
  const { rows } = await query<BudgetRow>(
    "SELECT * FROM budgets WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return rows[0] || null;
}

export async function listBudgets(userId: string) {
  const { rows } = await query<BudgetRow>(
    `
    SELECT b.*, row_to_json(c.*) as category
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id AND c.user_id = b.user_id
    WHERE b.user_id = $1
    `,
    [userId],
  );
  return rows;
}

export async function listExpenseTransactionsSince(userId: string, since: string) {
  const { rows } = await query<{ amount: number; category_id: string; date: string }>(
    `
    SELECT amount, category_id, date
    FROM transactions
    WHERE user_id = $1 AND type = 'expense' AND date >= $2
    `,
    [userId, since],
  );
  return rows;
}

export async function createBudget(userId: string, data: Record<string, unknown>) {
  const queryData = buildInsertQuery("budgets", data, { user_id: userId });
  const { rows } = await query<BudgetRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function updateBudget(userId: string, id: string, data: Record<string, unknown>) {
  const queryData = buildUpdateQuery("budgets", data, "id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  if (!queryData) return null;
  const { rows } = await query<BudgetRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function deleteBudget(userId: string, id: string) {
  await query("DELETE FROM budgets WHERE id = $1 AND user_id = $2", [id, userId]);
}
