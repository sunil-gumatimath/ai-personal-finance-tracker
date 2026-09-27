import type { ApiRequest } from "../_utils/types.js";
import { NotFoundError, ValidationError } from "../_errors/AppError.js";
import { assertUuid } from "../_domain/common.js";
import { validateCreateAccountInput, validateUpdateAccountInput } from "../_domain/accounts.js";
import { logEvent } from "./audit-log.service.js";
import {
  countLinkedTransactions,
  createAccount,
  deleteAccount,
  findAccountById,
  listAccounts,
  updateAccount,
} from "../_repositories/accounts.repository.js";

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
  // `balance` is accepted here as an OPENING balance — creating an account that
  // already exists in the real world legitimately needs one. It is rejected on
  // UPDATE (see `updateUserAccount`) because after the row exists the
  // `update_account_balance` trigger owns the value, and a manual correction
  // would be silently overwritten by the next transaction.
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
  validateUpdateAccountInput(data);
  const oldAccount = await findAccountById(userId, id);
  if (!oldAccount) throw new NotFoundError("Account not found");

  // Reject a balance correction outright rather than letting the query builder
  // drop it silently. `balance` is trigger-owned, so accepting the write would
  // look like it succeeded and then be overwritten by the next transaction —
  // the worst outcome, because the user believes the correction stuck.
  if (data.balance !== undefined) {
    throw new ValidationError(
      "Balance is calculated from transactions and cannot be edited directly",
    );
  }

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
