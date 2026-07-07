import { queryOne } from "../repositories/db.js";

type RecordLike = Record<string, unknown>;

export class OwnershipError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "OwnershipError";
    this.statusCode = statusCode;
  }
}

async function assertOwned(
  table: "accounts" | "categories" | "debts",
  userId: string,
  id: unknown,
  label: string,
) {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new OwnershipError(`${label} is required`);
  }

  const row = await queryOne<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );

  if (!row) {
    throw new OwnershipError(`${label} not found`, 404);
  }
}

export async function assertOwnedAccount(
  userId: string,
  accountId: unknown,
  label = "Account",
) {
  await assertOwned("accounts", userId, accountId, label);
}

export async function assertOwnedCategory(
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
    throw new OwnershipError("Valid transaction type is required");
  }

  await assertOwnedAccount(userId, tx.account_id, "Account");

  if (type === "transfer") {
    await assertOwnedAccount(userId, tx.to_account_id, "Destination account");
    if (tx.account_id === tx.to_account_id) {
      throw new OwnershipError("Transfer accounts must be different");
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

export function sendOwnershipError(
  res: { status: (code: number) => { json: (data: unknown) => unknown } },
  error: unknown,
) {
  if (error instanceof OwnershipError) {
    res.status(error.statusCode).json({ error: error.message });
    return true;
  }
  return false;
}
