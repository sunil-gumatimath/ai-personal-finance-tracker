import { ValidationError } from "../errors/AppError.js";
export { assertUuid } from "./common.js";

export type TransactionType = "income" | "expense" | "transfer";

export type TransactionInput = Record<string, unknown>;

export type TransactionListOptions = {
  since?: string;
  limit?: number | null;
};

const VALID_TRANSACTION_TYPES = new Set<TransactionType>([
  "income",
  "expense",
  "transfer",
]);

export function parseTransactionType(value: unknown): TransactionType {
  if (typeof value !== "string" || !VALID_TRANSACTION_TYPES.has(value as TransactionType)) {
    throw new ValidationError(
      "Valid transaction type is required (income, expense, transfer)",
    );
  }
  return value as TransactionType;
}

export function assertPositiveAmount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new ValidationError("Valid amount is required");
  }
}

export function validateCreateTransactionInput(data: TransactionInput) {
  parseTransactionType(data.type);
  assertPositiveAmount(data.amount);
}

export function validateListTransactionsOptions(options: TransactionListOptions) {
  if (options.since && !/^\d{4}-\d{2}-\d{2}$/.test(options.since)) {
    throw new ValidationError("Invalid date format. Use YYYY-MM-DD");
  }
}

export function normalizeTransactionLimit(limit: unknown): number | null {
  if (typeof limit !== "string" || limit.trim() === "") return null;
  const parsed = parseInt(limit, 10);
  return parsed > 0 && parsed <= 1000 ? parsed : null;
}
