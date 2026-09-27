import { queryOne } from "../_repositories/db.js";
import { NotFoundError, ValidationError } from "../_errors/AppError.js";

type RecordLike = Record<string, unknown>;

// NOTE: an `OwnershipError` class used to live here, documented as "403 by
// default" — but nothing ever threw it. `assertOwned` deliberately raises
// NotFoundError instead, so a cross-tenant id reads as absent rather than
// confirming the row exists (no existence oracle). The class was referenced
// only by a test, and its comment contradicted the real behaviour. Removed.

async function assertOwned(
  table: "accounts" | "categories" | "debts",
  userId: string,
  id: unknown,
  label: string,
  columns = "id",
): Promise<RecordLike | null> {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new ValidationError(`${label} is required`);
  }

  const row = await queryOne<RecordLike>(
    `SELECT ${columns} FROM ${table} WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );

  if (!row) {
    // Row filtered by user_id — report not-found without leaking existence.
    throw new NotFoundError(`${label} not found`);
  }
  return row;
}

async function assertOwnedAccount(
  userId: string,
  accountId: unknown,
  label = "Account",
): Promise<RecordLike | null> {
  // `is_active` is selected so callers can reject an archived account as a
  // transfer endpoint. The UI already filters these out, so the API was the
  // only place left to enforce it.
  return await assertOwned("accounts", userId, accountId, label, "id, is_active");
}

async function assertOwnedCategory(
  userId: string,
  categoryId: unknown,
  label = "Category",
): Promise<RecordLike | null> {
  // `type` is returned so callers can enforce category-type coherence.
  return await assertOwned("categories", userId, categoryId, label, "id, type");
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
    const destination = await assertOwnedAccount(
      userId,
      tx.to_account_id,
      "Destination account",
    );
    if (tx.account_id === tx.to_account_id) {
      throw new ValidationError("Transfer accounts must be different");
    }
    // An archived account is not a sensible transfer endpoint. The UI filters
    // `is_active`; the API did not, so a stale or hand-built request could
    // still move money into an archived account.
    if (destination && destination.is_active === false) {
      throw new ValidationError(
        "Transfers cannot use an inactive destination account",
      );
    }
    // A transfer is not a spending event, so it must not carry a category.
    // The dialog cleared `category_id` in the UI, but the API never did, so a
    // transfer with a category persisted and rendered a category badge in the
    // transaction table.
    if (tx.category_id != null && tx.category_id !== "") {
      throw new ValidationError("Transfers cannot have a category");
    }
    return;
  }

  if (tx.category_id != null && tx.category_id !== "") {
    const category = await assertOwnedCategory(userId, tx.category_id, "Category");
    // Category-type coherence. `ensure_transaction_refs_owned` (migration 004)
    // verified the category BELONGS to the user but never that its `type`
    // matched the transaction's. So an `expense` could point at an `income`
    // category and silently corrupt income/expense reporting — and any budget
    // on that category would stop counting the row, because budget queries
    // filter `type = 'expense'`.
    if (category && typeof category.type === "string" && category.type !== type) {
      throw new ValidationError(
        `A ${type} transaction cannot use a ${category.type} category`,
      );
    }
  }
}

export async function assertBudgetReferencesOwned(
  userId: string,
  data: RecordLike,
  existing?: RecordLike,
) {
  const budget = merged(data, existing);
  const category = await assertOwnedCategory(userId, budget.category_id, "Category");
  // A budget measures spending, so it belongs on an expense category. Without
  // this an income category could carry a budget that never accrues.
  if (category && category.type === "income") {
    throw new ValidationError("Budgets must use an expense category");
  }
}

export async function assertCategoryReferencesOwned(
  userId: string,
  data: RecordLike,
  existing?: RecordLike,
) {
  const category = merged(data, existing);
  if (category.parent_id == null || category.parent_id === "") return;
  await assertOwnedCategory(userId, category.parent_id, "Parent category");
}

export async function assertDebtPaymentReferencesOwned(userId: string, data: RecordLike) {
  await assertOwnedDebt(userId, data.debt_id, "Debt");
}
