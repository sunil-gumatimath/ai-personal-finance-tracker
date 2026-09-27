import { query } from "../_repositories/db.js";
import { buildInsertQuery, buildUpdateQuery } from "../_repositories/_query-builder.js";

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

  const { rows } = await query<TransactionRow & { total_count?: number }>(
    `
    SELECT
      t.*,
      row_to_json(c.*) as category,
      row_to_json(a.*) as account,
      row_to_json(ta.*) as to_account,
      -- Total matching rows BEFORE the limit, so the client can tell a
      -- genuinely complete set from a truncated one. Without it the Reports
      -- page had to infer truncation from the row count, which is wrong at
      -- the boundary: a user with exactly 1000 transactions saw a truncation
      -- warning for a set that was not truncated.
      COUNT(*) OVER () as total_count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id AND c.user_id = t.user_id
    LEFT JOIN accounts a ON t.account_id = a.id AND a.user_id = t.user_id
    LEFT JOIN accounts ta ON t.to_account_id = ta.id AND ta.user_id = t.user_id
    WHERE ${whereParts.join(" AND ")}
    -- The trailing ", t.id DESC" is a TIEBREAKER, not decoration.
    --
    -- Combined with a LIMIT, ordering by date alone makes WHICH rows survive
    -- the cut non-deterministic: transactions sharing a date can come back in
    -- any order. Reports requests limit: 1000, so a user with 1,050
    -- transactions could get an arbitrary subset of one day's rows -- and the
    -- September totals, category breakdown, trend chart and exported PDF would
    -- all change on reload with no way for the client to detect it.
    ORDER BY t.date DESC, t.id DESC
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
