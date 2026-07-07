import { ValidationError } from "../errors/AppError.js";

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

export function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  message: string,
): asserts value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(message);
  }
}
