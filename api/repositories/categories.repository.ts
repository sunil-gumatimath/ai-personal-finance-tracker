import { query } from "../repositories/db.js";
import { buildInsertQuery, buildUpdateQuery } from "../repositories/_query-builder.js";

export type CategoryRow = Record<string, unknown> & { id: string };

export async function findCategoryById(userId: string, id: string) {
  const { rows } = await query<CategoryRow>(
    "SELECT * FROM categories WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return rows[0] || null;
}

export async function listCategories(userId: string, type?: string) {
  if (type) {
    const { rows } = await query<CategoryRow>(
      "SELECT * FROM categories WHERE user_id = $1 AND type = $2",
      [userId, type],
    );
    return rows;
  }

  const { rows } = await query<CategoryRow>("SELECT * FROM categories WHERE user_id = $1", [
    userId,
  ]);
  return rows;
}

export async function createCategory(userId: string, data: Record<string, unknown>) {
  const queryData = buildInsertQuery("categories", data, { user_id: userId });
  const { rows } = await query<CategoryRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function updateCategory(
  userId: string,
  id: string,
  data: Record<string, unknown>,
) {
  const queryData = buildUpdateQuery("categories", data, "id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  if (!queryData) return null;
  const { rows } = await query<CategoryRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function deleteCategory(userId: string, id: string) {
  await query("DELETE FROM categories WHERE id = $1 AND user_id = $2", [id, userId]);
}
