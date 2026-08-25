import type { ApiResponse } from "../_utils/types.js";
import { isAppError } from "../_errors/AppError.js";

/**
 * Map a thrown error to an HTTP response. AppError subclasses carry their
 * status code and decide whether the message is safe to expose; everything
 * else is a generic 500 (never leak internals to clients).
 */
export function sendApiError(res: ApiResponse, error: unknown) {
  if (isAppError(error)) {
    res.status(error.statusCode).json({
      error: error.expose ? error.message : "Server error",
    });
    return;
  }

  res.status(500).json({ error: "Server error" });
}
