import { query } from "../repositories/db.js";
import { buildInsertQuery, buildUpdateQuery } from "../repositories/_query-builder.js";

export type DebtRow = Record<string, unknown> & { id: string };
export type DebtPaymentRow = Record<string, unknown> & { id: string };

export async function findDebtById(userId: string, id: string) {
  const { rows } = await query<DebtRow>(
    "SELECT * FROM debts WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return rows[0] || null;
}

export async function listDebts(userId: string) {
  const { rows } = await query<DebtRow>(
    "SELECT * FROM debts WHERE user_id = $1 ORDER BY is_active DESC, current_balance DESC",
    [userId],
  );
  return rows;
}

export async function listDebtPayments(userId: string, debtId: string) {
  const { rows } = await query<DebtPaymentRow>(
    `
    SELECT * FROM debt_payments
    WHERE debt_id = $1 AND user_id = $2
    ORDER BY payment_date DESC
    LIMIT 10
    `,
    [debtId, userId],
  );
  return rows;
}

export async function createDebt(userId: string, data: Record<string, unknown>) {
  const queryData = buildInsertQuery("debts", data, { user_id: userId });
  const { rows } = await query<DebtRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function updateDebt(userId: string, id: string, data: Record<string, unknown>) {
  const queryData = buildUpdateQuery("debts", data, "id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  if (!queryData) return null;
  const { rows } = await query<DebtRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function deleteDebt(userId: string, id: string) {
  await query("DELETE FROM debts WHERE id = $1 AND user_id = $2", [id, userId]);
}

export async function createDebtPayment(userId: string, data: Record<string, unknown>) {
  const queryData = buildInsertQuery("debt_payments", data, { user_id: userId });
  const { rows } = await query<DebtPaymentRow>(queryData.text, queryData.values);
  return rows[0] || null;
}
