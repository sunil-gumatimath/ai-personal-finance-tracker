import { query } from "../_repositories/db.js";
import { buildInsertQuery, buildUpdateQuery } from "../_repositories/_query-builder.js";

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

/**
 * Insert a debt payment. The DB trigger from migration 006 is the single
 * owner of `debts.current_balance` — it recomputes the balance from the
 * payment history and rejects overpayments atomically with this INSERT,
 * so no manual balance write happens here (a previous version decremented
 * the balance in the same CTE, which fought the trigger's recompute).
 *
 * The debt row is read back AFTER the insert so callers can echo the new
 * balance immediately.
 */
export async function createDebtPayment(
  userId: string,
  data: Record<string, unknown>,
): Promise<{ payment: DebtPaymentRow; debt: DebtRow } | null> {
  const fieldKeys = [
    "amount",
    "principal_amount",
    "interest_amount",
    "payment_date",
    "notes",
  ].filter((key) => data[key] !== undefined);

  const values: unknown[] = [data.debt_id, userId];
  for (const key of fieldKeys) values.push(data[key]);

  const columns = ["debt_id", "user_id", ...fieldKeys].join(", ");
  const placeholders = ["$1", "$2", ...fieldKeys.map((_, i) => `$${i + 3}`)].join(
    ", ",
  );

  // EXISTS guard: inserts nothing when the debt doesn't belong to the user
  // (caller turns an empty result into a 404).
  const { rows } = await query<DebtPaymentRow>(
    `
    INSERT INTO debt_payments (${columns})
    SELECT ${placeholders}
    WHERE EXISTS (
      SELECT 1 FROM debts WHERE id = $1 AND user_id = $2
    )
    RETURNING *
    `,
    values,
  );
  const payment = rows[0];
  if (!payment) return null;

  const debt = await findDebtById(userId, String(data.debt_id));
  if (!debt) return null;
  return { payment, debt };
}
