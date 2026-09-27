import { query } from "../_repositories/db.js";
import { buildInsertQuery, buildUpdateQuery } from "../_repositories/_query-builder.js";

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

/**
 * True when making `categoryId`'s parent `newParentId` would create a cycle.
 *
 * Walks UP the existing ancestor chain from `newParentId` with a depth cap, so
 * the query itself cannot loop on pre-existing (or concurrently created) bad
 * data. Returns true for a self-parent, for a direct parent/child reversal, and
 * for any longer cycle.
 *
 * The alternative — trusting the app to keep the tree acyclic — is what let
 * `PUT {"parent_id": "<own id>"}` through before: `parent_id` has only
 * `ON DELETE SET NULL`, and no CHECK or trigger guards it, so a cycle made a
 * recursive tree render hang.
 */
export async function wouldCreateCategoryCycle(
  userId: string,
  categoryId: string,
  newParentId: string,
): Promise<boolean> {
  if (categoryId === newParentId) return true;

  // Depth cap: far beyond any real category hierarchy, and guarantees
  // termination even if the stored data is already cyclic.
  const MAX_DEPTH = 64;
  const { rows } = await query<{ id: string; parent_id: string | null }>(
    `WITH RECURSIVE chain AS (
       SELECT c.id, c.parent_id, 1 AS depth
         FROM categories c
        WHERE c.id = $2 AND c.user_id = $1
       UNION ALL
       SELECT p.id, p.parent_id, ch.depth + 1
         FROM categories p
         JOIN chain ch ON ch.parent_id = p.id
        WHERE ch.depth < $4
     )
     SELECT id FROM chain WHERE id = $3 LIMIT 1`,
    [userId, newParentId, categoryId, MAX_DEPTH],
  );
  return rows.length > 0;
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
