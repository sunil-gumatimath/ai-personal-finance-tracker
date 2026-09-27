import { ValidationError } from "../_errors/AppError.js";

export function assertUuid(value: string, label: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ValidationError(`Invalid ${label} format`);
  }
}

export function assertRequiredString(value: unknown, message: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(message);
  }
}

export function assertPositiveNumber(value: unknown, message: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new ValidationError(message);
  }
}

/**
 * Finite number within an inclusive range. Rejects non-numbers outright —
 * numeric-looking strings must be coerced by the caller before persisting.
 */
export function assertNumberInRange(
  value: unknown,
  min: number,
  max: number,
  message: string,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new ValidationError(message);
  }
}

/** Bounded optional string; rejects wrong types and over-length values. */
export function assertOptionalBoundedString(
  value: unknown,
  maxLength: number,
  message: string,
): void {
  if (value === undefined || value === null) return;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new ValidationError(message);
  }
}

/**
 * True when `value` is a real YYYY-MM-DD calendar date.
 *
 * A bare `/^\d{4}-\d{2}-\d{2}$/` test is NOT enough: it happily accepts
 * "2026-02-31", "2026-13-01" and "2026-00-00", all of which then reach
 * Postgres and surface as an opaque `invalid input syntax for type date` 500
 * rather than a 400 the client can act on. This is the single implementation —
 * the copy that used to live in `_domain/transactions.ts` (and again in
 * `_domain/ai-parse.ts`) now lives here.
 */
export function isCalendarDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Round-trip through Date to reject overflow days (Feb 30, Apr 31, ...).
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** ISO calendar date (YYYY-MM-DD), e.g. deadlines, payment dates. */
export function assertIsoDateString(value: unknown, message: string): void {
  if (value === undefined || value === null) return;
  if (!isCalendarDateString(value)) {
    throw new ValidationError(message);
  }
}

/**
 * Hard ceiling for any monetary amount, in whole currency units.
 *
 * Matches the `DECIMAL(15,2)` columns: 15 total digits, 2 after the point, so
 * at most 10^13 - 1 fits. One trillion is comfortably inside that and still
 * well beyond any plausible personal balance. This used to be redeclared in
 * four domain files, so `POST` paths could omit the check entirely and let an
 * overflowing value reach the database.
 */
export const MAX_MONEY_AMOUNT = 1_000_000_000_000;

/** Positive, finite, and within {@link MAX_MONEY_AMOUNT}. */
export function assertMoneyAmount(value: unknown, message: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(message);
  }
  if (value <= 0 || value > MAX_MONEY_AMOUNT) {
    throw new ValidationError(message);
  }
}

/** Non-negative, finite, and within {@link MAX_MONEY_AMOUNT}. */
export function assertNonNegativeMoney(
  value: unknown,
  message: string,
): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(message);
  }
  if (value < 0 || value > MAX_MONEY_AMOUNT) {
    throw new ValidationError(message);
  }
}

/** ISO-4217-style currency code, e.g. USD, INR. */
export function assertCurrencyCode(value: unknown, message: string): void {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) {
    throw new ValidationError(message);
  }
}

export function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  message: string,
): asserts value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(message);
  }
}
