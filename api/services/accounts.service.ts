import type { ApiRequest } from "../utils/types.js";
import { NotFoundError, ValidationError } from "../errors/AppError.js";
import { assertUuid } from "../domain/common.js";
import { validateCreateAccountInput } from "../domain/accounts.js";
import { logEvent } from "./audit-log.service.js";
import {
  countLinkedTransactions,
  createAccount,
  deleteAccount,
  findAccountById,
  listAccounts,
  updateAccount,
} from "../repositories/accounts.repository.js";

export async function listUserAccounts(userId: string) {
  return await listAccounts(userId);
}

export async function getLinkedTransactionCount(userId: string, accountId: string) {
  assertUuid(accountId, "account ID");
  return await countLinkedTransactions(userId, accountId);
}

export async function createUserAccount(
  req: ApiRequest,
  userId: string,
  data: Record<string, unknown>,
) {
  validateCreateAccountInput(data);
  const account = await createAccount(userId, data);
  if (!account) throw new Error("Account creation failed");

  await logEvent(req, {
    action: "ACCOUNT_CREATED",
    resource: `accounts/${account.id}`,
    newValue: JSON.stringify(account),
    severity: "info",
    status: "success",
    metadata: { name: account.name, type: account.type },
  });

  return account;
}

export async function updateUserAccount(
  req: ApiRequest,
  userId: string,
  id: string,
  data: Record<string, unknown>,
) {
  assertUuid(id, "account ID");
  const oldAccount = await findAccountById(userId, id);
  if (!oldAccount) throw new NotFoundError("Account not found");

  const account = await updateAccount(userId, id, data);
  if (!account) throw new ValidationError("No valid fields to update");

  await logEvent(req, {
    action: "ACCOUNT_EDITED",
    resource: `accounts/${id}`,
    oldValue: JSON.stringify(oldAccount),
    newValue: JSON.stringify(account),
    severity: "info",
    status: "success",
    metadata: {
      oldBalance: oldAccount.balance,
      newBalance: account.balance,
      name: account.name,
    },
  });

  return account;
}

export async function deleteUserAccount(
  req: ApiRequest,
  userId: string,
  id: string,
  cascade: boolean,
) {
  assertUuid(id, "account ID");
  const oldAccount = await findAccountById(userId, id);
  if (!oldAccount) throw new NotFoundError("Account not found");

  await deleteAccount(userId, id, cascade);

  await logEvent(req, {
    action: "ACCOUNT_DELETED",
    resource: `accounts/${id}`,
    oldValue: JSON.stringify(oldAccount),
    severity: "warning",
    status: "success",
    metadata: {
      name: oldAccount.name,
      type: oldAccount.type,
      balance: oldAccount.balance,
      cascade,
    },
  });
}
