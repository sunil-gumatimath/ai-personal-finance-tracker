import type { ApiRequest } from "../utils/types.js";
import { NotFoundError, ValidationError } from "../errors/AppError.js";
import {
  assertUuid,
  normalizeTransactionLimit,
  validateCreateTransactionInput,
  validateListTransactionsOptions,
} from "../domain/transactions.js";
import { assertTransactionReferencesOwned } from "./ownership.service.js";
import { logEvent } from "./audit-log.service.js";
import {
  createTransaction,
  deleteTransaction,
  findTransactionById,
  listTransactions,
  updateTransaction,
  type TransactionRow,
} from "../repositories/transactions.repository.js";

function ensureTransactionId(id: string) {
  assertUuid(id, "transaction ID");
}

export async function listUserTransactions(
  userId: string,
  query: Record<string, string | undefined> = {},
) {
  const since = query.since;
  const limit = normalizeTransactionLimit(query.limit);
  validateListTransactionsOptions({ since, limit });

  return await listTransactions({ userId, since, limit });
}

export async function createUserTransaction(
  req: ApiRequest,
  userId: string,
  data: Record<string, unknown>,
) {
  validateCreateTransactionInput(data);
  await assertTransactionReferencesOwned(userId, data);

  const createdTransaction = await createTransaction(userId, data);
  if (!createdTransaction) {
    throw new Error("Transaction creation failed");
  }

  await logEvent(req, {
    action: "TRANSACTION_CREATED",
    resource: `transactions/${createdTransaction.id}`,
    newValue: JSON.stringify(createdTransaction),
    severity: "info",
    status: "success",
    metadata: {
      type: createdTransaction.type,
      amount: createdTransaction.amount,
      description: createdTransaction.description,
    },
  });

  return createdTransaction;
}

export async function updateUserTransaction(
  req: ApiRequest,
  userId: string,
  id: string,
  data: Record<string, unknown>,
) {
  ensureTransactionId(id);

  const oldTransaction = await findTransactionById(userId, id);
  if (!oldTransaction) {
    throw new NotFoundError("Transaction not found");
  }

  await assertTransactionReferencesOwned(userId, data, oldTransaction);

  const updatedTransaction = await updateTransaction(userId, id, data);
  if (!updatedTransaction) {
    throw new ValidationError("No valid fields to update");
  }

  await logEvent(req, {
    action: "TRANSACTION_EDITED",
    resource: `transactions/${id}`,
    oldValue: JSON.stringify(oldTransaction),
    newValue: JSON.stringify(updatedTransaction),
    severity: "info",
    status: "success",
    metadata: {
      oldAmount: oldTransaction.amount,
      newAmount: updatedTransaction.amount,
      description: updatedTransaction.description,
    },
  });

  return updatedTransaction;
}

export async function deleteUserTransaction(req: ApiRequest, userId: string, id: string) {
  ensureTransactionId(id);

  const oldTransaction: TransactionRow | null = await findTransactionById(userId, id);
  if (!oldTransaction) {
    throw new NotFoundError("Transaction not found");
  }

  await deleteTransaction(userId, id);

  await logEvent(req, {
    action: "TRANSACTION_DELETED",
    resource: `transactions/${id}`,
    oldValue: JSON.stringify(oldTransaction),
    severity: "warning",
    status: "success",
    metadata: {
      type: oldTransaction.type,
      amount: oldTransaction.amount,
      description: oldTransaction.description,
    },
  });
}
