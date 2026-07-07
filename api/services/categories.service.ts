import { NotFoundError, ValidationError } from "../errors/AppError.js";
import { assertUuid } from "../domain/common.js";
import { validateCategoryType, validateCreateCategoryInput } from "../domain/categories.js";
import { ensureDefaultCategories } from "../utils/default-categories.js";
import { assertCategoryReferencesOwned } from "./ownership.service.js";
import {
  createCategory,
  deleteCategory,
  findCategoryById,
  listCategories,
  updateCategory,
} from "../repositories/categories.repository.js";

export async function listUserCategories(userId: string, type?: string) {
  await ensureDefaultCategories(userId);
  if (type) validateCategoryType(type);
  return await listCategories(userId, type);
}

export async function createUserCategory(userId: string, data: Record<string, unknown>) {
  validateCreateCategoryInput(data);
  await assertCategoryReferencesOwned(userId, data);

  const category = await createCategory(userId, data);
  if (!category) throw new Error("Category creation failed");
  return category;
}

export async function updateUserCategory(
  userId: string,
  id: string,
  data: Record<string, unknown>,
) {
  assertUuid(id, "category ID");
  const existing = await findCategoryById(userId, id);
  if (!existing) throw new NotFoundError("Category not found");

  await assertCategoryReferencesOwned(userId, data);

  const category = await updateCategory(userId, id, data);
  if (!category) throw new ValidationError("No valid fields to update");
  return category;
}

export async function deleteUserCategory(userId: string, id: string) {
  assertUuid(id, "category ID");
  await deleteCategory(userId, id);
}
