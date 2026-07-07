import { query } from "../repositories/db.js";
import { buildInsertQuery, buildUpdateQuery } from "../repositories/_query-builder.js";

export type GoalRow = Record<string, unknown> & { id: string };

export async function findGoalById(userId: string, id: string) {
  const { rows } = await query<GoalRow>(
    "SELECT * FROM goals WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return rows[0] || null;
}

export async function listGoals(userId: string) {
  const { rows } = await query<GoalRow>(
    "SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return rows;
}

export async function createGoal(userId: string, data: Record<string, unknown>) {
  const queryData = buildInsertQuery("goals", data, { user_id: userId });
  const { rows } = await query<GoalRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function updateGoal(userId: string, id: string, data: Record<string, unknown>) {
  const queryData = buildUpdateQuery("goals", data, "id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  if (!queryData) return null;
  const { rows } = await query<GoalRow>(queryData.text, queryData.values);
  return rows[0] || null;
}

export async function deleteGoal(userId: string, id: string) {
  await query("DELETE FROM goals WHERE id = $1 AND user_id = $2", [id, userId]);
}
