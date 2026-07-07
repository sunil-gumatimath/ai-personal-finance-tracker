import type { ApiResponse } from "../utils/types.js";
import { isAppError } from "../errors/AppError.js";
import { OwnershipError } from "../services/ownership.service.js";

export function sendApiError(res: ApiResponse, error: unknown) {
  if (error instanceof OwnershipError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (isAppError(error)) {
    res.status(error.statusCode).json({
      error: error.expose ? error.message : "Server error",
    });
    return;
  }

  if (
    error instanceof Error &&
    (error.message.includes("Invalid") || error.message.includes("exceeds maximum length"))
  ) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  res.status(500).json({ error: "Server error" });
}
