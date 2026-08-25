import { queryOne } from "../_repositories/db.js";
import { AppError, NotFoundError, ValidationError } from "../_errors/AppError.js";

type RecordLike = Record<string, unknown>;

/**
 * Cross-user / cross-tenant access error (403 by default). Part of the
 * AppError hierarchy so sendApiError handles it through the generic path.
 * Kept as a distinct class so callers can still branch on it explicitly.
 */
export class OwnershipError extends AppError {
  constructor(message: string, statusCode = 403) {
    super(message, statusCode, true);
    this.name = "OwnershipError";
  }
}

async function assertOwned(
  table: "accounts" | "categories" | "debts",
  userId: string,
  id: unknown,
  label: string,
) {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new ValidationError(`${label} is required`);
  }

  const row = await queryOne<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );

  if (!row) {
    // Row filtered by user_id — report not-found without leaking existence.
    throw new NotFoundError(`${label} not found`);
  }
}

async function assertOwnedAccount(
  userId: string,
  accountId: unknown,
  label = "Account",
) {
  await assertOwned("accounts", userId, accountId, label);
}

async function assertOwnedCategory(
  userId: string,
  categoryId: unknown,
  label = "Category",
) {
  await assertOwned("categories", userId, categoryId, label);
}

export async function assertOwnedDebt(
  userId: string,
  debtId: unknown,
  label = "Debt",
) {
  await assertOwned("debts", userId, debtId, label);
}

function merged(data: RecordLike, existing?: RecordLike): RecordLike {
  return { ...(existing || {}), ...data };
}

export async function assertTransactionReferencesOwned(
  userId: string,
  data: RecordLike,
  existing?: RecordLike,
) {
  const tx = merged(data, existing);
  const type = tx.type;

  if (!["income", "expense", "transfer"].includes(String(type))) {
    throw new ValidationError("Valid transaction type is required");
  }

  await assertOwnedAccount(userId, tx.account_id, "Account");

  if (type === "transfer") {
    await assertOwnedAccount(userId, tx.to_account_id, "Destination account");
    if (tx.account_id === tx.to_account_id) {
      throw new ValidationError("Transfer accounts must be different");
    }
  }

  if (tx.category_id != null && tx.category_id !== "") {
    await assertOwnedCategory(userId, tx.category_id, "Category");
  }
}

export async function assertBudgetReferencesOwned(
  userId: string,
  data: RecordLike,
  existing?: RecordLike,
) {
  const budget = merged(data, existing);
  await assertOwnedCategory(userId, budget.category_id, "Category");
}

export async function assertCategoryReferencesOwned(userId: string, data: RecordLike) {
  if (data.parent_id == null || data.parent_id === "") return;
  await assertOwnedCategory(userId, data.parent_id, "Parent category");
}

export async function assertDebtPaymentReferencesOwned(userId: string, data: RecordLike) {
  await assertOwnedDebt(userId, data.debt_id, "Debt");
}
