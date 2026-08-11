/**
 * Centralized API error handling for the frontend.
 *
 * Use `ApiError.fromResponse(...)` to convert any failed fetch into a typed
 * error with status + message. The `apiFetch` helper in `lib/api.ts` uses
 * this; callers can `instanceof ApiError` to distinguish HTTP failures from
 * network/runtime errors.
 */

export type ApiErrorOptions = {
  status?: number
  code?: string
  details?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.code = options.code
    this.details = options.details
  }

  /** True for 401/403 — caller should redirect to login or clear session. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403
  }

  /** True for 429 — caller should respect retryAfter if present. */
  get isRateLimited(): boolean {
    return this.status === 429
  }

  /** True for network failures or 5xx — safe to retry with backoff. */
  get isRetryable(): boolean {
    return this.status === 0 || (this.status >= 500 && this.status <= 599)
  }

  static async fromResponse(res: Response, fallback?: string): Promise<ApiError> {
    let message = fallback ?? `Request failed (${res.status})`
    let code: string | undefined
    let details: unknown
    try {
      const data = (await res.json()) as { error?: string; code?: string; details?: unknown }
      if (data?.error) message = data.error
      code = data?.code
      details = data?.details
    } catch {
      // response had no JSON body; keep fallback message
    }
    return new ApiError(message, { status: res.status, code, details })
  }
}

/** True if the given value was thrown as an ApiError. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}
