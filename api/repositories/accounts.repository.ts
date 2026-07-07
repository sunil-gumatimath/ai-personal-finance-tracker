import { query, queryOne } from "../repositories/db.js";
import { buildInsertQuery, buildUpdateQuery } from "../repositories/_query-builder.js";

export type AccountRow = Record<string, unknown> & { id: string; name?: string; type?: string };

export async function listAccounts(userId: string) {
  const { rows } = await query(
    "SELECT * FROM accounts WHERE user_id = $1 ORDER BY is_active DESC, name ASC",
    [userId],
  );
  return rows;
}

export async function findAccountById(userId: string, id: string) {
  const { rows } = await query<AccountRow>(
    "SELECT * FROM accounts WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return rows[0] || null;
}

export async function countLinkedTransactions(userId: string, accountId: string) {
  const row = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM transactions WHERE (account_id = $1 OR to_account_id = $1) AND user_id = $2",
    [accountId, userId],
  );
  return parseInt(row?.count || "0", 10);
}

export async function createAccount(userId: string, data: Record<string, unknown>) {
  const queryData = buildInsertQuery("accounts", data, { user_id: userId });
  const { rows } = await query<AccountRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function updateAccount(userId: string, id: string, data: Record<string, unknown>) {
  const queryData = buildUpdateQuery("accounts", data, "id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  if (!queryData) return null;
  const { rows } = await query<AccountRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function deleteAccount(userId: string, id: string, cascade: boolean) {
  if (cascade) {
    await query("DELETE FROM transactions WHERE (account_id = $1 OR to_account_id = $1) AND user_id = $2", [
      id,
      userId,
    ]);
  }
  await query("DELETE FROM accounts WHERE id = $1 AND user_id = $2", [id, userId]);
}
