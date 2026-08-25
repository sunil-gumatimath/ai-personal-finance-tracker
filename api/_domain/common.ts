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

/** ISO calendar date (YYYY-MM-DD), e.g. deadlines, payment dates. */
export function assertIsoDateString(value: unknown, message: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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
