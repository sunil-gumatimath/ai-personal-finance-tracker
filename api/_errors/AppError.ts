export class AppError extends Error {
  statusCode: number;
  expose: boolean;

  constructor(message: string, statusCode = 500, expose = false) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.expose = expose;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request") {
    super(message, 400, true);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, true);
    this.name = "NotFoundError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
