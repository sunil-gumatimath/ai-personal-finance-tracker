import { NotFoundError, ValidationError } from "../_errors/AppError.js";
import { assertUuid } from "../_domain/common.js";
import { validateCategoryType, validateCreateCategoryInput, validateUpdateCategoryInput } from "../_domain/categories.js";
import { ensureDefaultCategories } from "../_utils/default-categories.js";
import { assertCategoryReferencesOwned } from "./ownership.service.js";
import {
  createCategory,
  deleteCategory,
  findCategoryById,
  listCategories,
  updateCategory,
  wouldCreateCategoryCycle,
} from "../_repositories/categories.repository.js";

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

  // This call previously did not exist, so an update could set an unchecked
  // `type` (a 500 from the DB CHECK) and an unchecked `parent_id` (a cycle).
  validateUpdateCategoryInput(data);

  await assertCategoryReferencesOwned(userId, data, existing);

  // Reject a parent assignment that would make the hierarchy cyclic.
  if (data.parent_id !== undefined && data.parent_id !== null && data.parent_id !== "") {
    const parentId = String(data.parent_id);
    if (await wouldCreateCategoryCycle(userId, id, parentId)) {
      throw new ValidationError(
        "That parent would create a circular category hierarchy",
      );
    }
  }

  const category = await updateCategory(userId, id, data);
  if (!category) throw new ValidationError("No valid fields to update");
  return category;
}

export async function deleteUserCategory(userId: string, id: string) {
  assertUuid(id, "category ID");
  await deleteCategory(userId, id);
}
