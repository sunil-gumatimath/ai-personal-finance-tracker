import { NotFoundError, ValidationError } from "../errors/AppError.js";
import { assertUuid } from "../domain/common.js";
import { validateCreateDebtInput, validateCreateDebtPaymentInput } from "../domain/debts.js";
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
} from "../repositories/debts.repository.js";

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
) {
  validateCreateDebtPaymentInput(data);
  await assertDebtPaymentReferencesOwned(userId, data);

  const payment = await createDebtPayment(userId, data);
  if (!payment) throw new Error("Debt payment creation failed");
  return payment;
}
