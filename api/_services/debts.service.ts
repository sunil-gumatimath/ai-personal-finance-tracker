import { NotFoundError, ValidationError } from "../_errors/AppError.js";
import { assertUuid } from "../_domain/common.js";
import {
  resolveDebtPaymentPrincipal,
  validateCreateDebtInput,
  validateCreateDebtPaymentInput,
  validateUpdateDebtInput,
} from "../_domain/debts.js";
import {
  assertDebtPaymentReferencesOwned,
  assertOwnedDebt,
} from "./ownership.service.js";
import {
  createDebt,
  createDebtPayment,
  deleteDebt,
  findDebtById,
  listDebtPayments,
  listDebts,
  updateDebt,
} from "../_repositories/debts.repository.js";

export async function listUserDebts(userId: string) {
  return await listDebts(userId);
}

export async function listUserDebtPayments(userId: string, debtId: string) {
  assertUuid(debtId, "debt ID");
  await assertOwnedDebt(userId, debtId);
  return await listDebtPayments(userId, debtId);
}

export async function createUserDebt(userId: string, data: Record<string, unknown>) {
  validateCreateDebtInput(data);

  const debt = await createDebt(userId, data);
  if (!debt) throw new Error("Debt creation failed");
  return debt;
}

export async function updateUserDebt(userId: string, id: string, data: Record<string, unknown>) {
  assertUuid(id, "debt ID");
  validateUpdateDebtInput(data);
  const existing = await findDebtById(userId, id);
  if (!existing) throw new NotFoundError("Debt not found");

  const debt = await updateDebt(userId, id, data);
  if (!debt) throw new ValidationError("No valid fields to update");
  return debt;
}

export async function deleteUserDebt(userId: string, id: string) {
  assertUuid(id, "debt ID");
  await deleteDebt(userId, id);
}

export async function createUserDebtPayment(
  userId: string,
  data: Record<string, unknown>,
): Promise<{ payment: Record<string, unknown>; debt: Record<string, unknown> }> {
  validateCreateDebtPaymentInput(data);
  await assertDebtPaymentReferencesOwned(userId, data);

  // Resolve the principal ONCE and write it explicitly. The column is
  // `NOT NULL DEFAULT 0`, so an omitted `principal_amount` used to store 0
  // while the overpayment check below assumed the full `amount` — and since
  // migration 006 derives `debts.current_balance` from `SUM(principal_amount)`,
  // the recorded payment never moved the balance.
  const principal = resolveDebtPaymentPrincipal(data);
  const paymentData: Record<string, unknown> = {
    ...data,
    principal_amount: principal,
  };

  // Friendly pre-check so a routine overpayment is a 400, not the DB
  // trigger's raw exception (500). The trigger remains the authoritative
  // backstop for races between this check and the insert.
  const existing = await findDebtById(userId, String(data.debt_id));
  if (!existing) throw new NotFoundError("Debt not found");
  if (!Number.isFinite(principal) || principal > Number(existing.current_balance)) {
    throw new ValidationError("Payment principal exceeds remaining balance");
  }

  // Inserts the payment; the DB trigger (migration 006) atomically maintains
  // debts.current_balance. Returns the payment plus the post-payment debt row.
  const result = await createDebtPayment(userId, paymentData);
  if (!result) throw new NotFoundError("Debt not found");
  return result;
}
