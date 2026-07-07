import { query } from "../repositories/db.js";
import { buildInsertQuery, buildUpdateQuery } from "../repositories/_query-builder.js";

export type TransactionRow = Record<string, unknown> & {
  id: string;
  type?: string;
  amount?: number | string;
  description?: string | null;
};

export type ListTransactionsParams = {
  userId: string;
  since?: string;
  limit?: number | null;
};

export async function findTransactionById(userId: string, id: string) {
  const { rows } = await query<TransactionRow>(
    "SELECT * FROM transactions WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return rows[0] || null;
}

export async function listTransactions({ userId, since, limit }: ListTransactionsParams) {
  const whereParts = ["t.user_id = $1"];
  const params: unknown[] = [userId];

  if (since) {
    params.push(since);
    whereParts.push(`t.date >= $${params.length}`);
  }

  const limitClause = limit ? `LIMIT $${params.length + 1}` : "";
  if (limit) params.push(limit);

  const { rows } = await query(
    `
    SELECT
      t.*,
      row_to_json(c.*) as category,
      row_to_json(a.*) as account,
      row_to_json(ta.*) as to_account
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id AND c.user_id = t.user_id
    LEFT JOIN accounts a ON t.account_id = a.id AND a.user_id = t.user_id
    LEFT JOIN accounts ta ON t.to_account_id = ta.id AND ta.user_id = t.user_id
    WHERE ${whereParts.join(" AND ")}
    ORDER BY t.date DESC
    ${limitClause}
    `,
    params,
  );

  return rows;
}

export async function createTransaction(userId: string, data: Record<string, unknown>) {
  const queryData = buildInsertQuery("transactions", data, { user_id: userId });
  const { rows } = await query<TransactionRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function updateTransaction(
  userId: string,
  id: string,
  data: Record<string, unknown>,
) {
  const queryData = buildUpdateQuery(
    "transactions",
    data,
    "id = $1 AND user_id = $2",
    [id, userId],
  );

  if (!queryData) return null;

  const { rows } = await query<TransactionRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function deleteTransaction(userId: string, id: string) {
  await query("DELETE FROM transactions WHERE id = $1 AND user_id = $2", [id, userId]);
}
