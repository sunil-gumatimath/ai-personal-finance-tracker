import { NotFoundError, ValidationError } from "../errors/AppError.js";
import { assertUuid } from "../domain/common.js";
import { validateCreateGoalInput } from "../domain/goals.js";
import {
  createGoal,
  deleteGoal,
  findGoalById,
  listGoals,
  updateGoal,
} from "../repositories/goals.repository.js";

export async function listUserGoals(userId: string) {
  return await listGoals(userId);
}

export async function createUserGoal(userId: string, data: Record<string, unknown>) {
  validateCreateGoalInput(data);

  const goal = await createGoal(userId, data);
  if (!goal) throw new Error("Goal creation failed");
  return goal;
}

export async function updateUserGoal(userId: string, id: string, data: Record<string, unknown>) {
  assertUuid(id, "goal ID");
  const existing = await findGoalById(userId, id);
  if (!existing) throw new NotFoundError("Goal not found");

  const goal = await updateGoal(userId, id, data);
  if (!goal) throw new ValidationError("No valid fields to update");
  return goal;
}

export async function deleteUserGoal(userId: string, id: string) {
  assertUuid(id, "goal ID");
  await deleteGoal(userId, id);
}
