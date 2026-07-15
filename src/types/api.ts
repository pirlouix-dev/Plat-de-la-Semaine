/**
 * API communication types for "Plat de la Semaine"
 *
 * Standardised response envelopes used by the .NET backend.
 */

// ── Success envelopes ─────────────────────────────────────────────────────────

/** Standard single-resource API response */
export interface ApiResponse<T> {
  data: T;
}

/** Standard paginated or collection API response */
export interface ApiListResponse<T> {
  data: T[];
  total: number;
}

/** Standard empty success (204 No Content equivalent) */
export interface ApiEmptyResponse {
  success: true;
}

// ── Error envelopes ──────────────────────────────────────────────────────────

/** Structured error detail returned by the backend error middleware */
export interface ApiErrorDetail {
  /** Machine-readable error code (e.g., "VALIDATION_ERROR", "NOT_FOUND") */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional field-level validation errors */
  details?: ApiFieldError[];
}

/** Field-level validation error */
export interface ApiFieldError {
  /** The field that failed validation */
  field: string;
  /** Validation error message */
  message: string;
  /** Rejected value (if available) */
  rejectedValue?: unknown;
}

// ── Generic wrapper ──────────────────────────────────────────────────────────

/**
 * Union type for any API call result.
 * Use `isApiError(response)` to narrow the type.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorDetail };

/** Narrow an ApiResult to the error case */
export function isApiError<T>(
  result: ApiResult<T>,
): result is { ok: false; error: ApiErrorDetail } {
  return !result.ok;
}

/** Narrow an ApiResult to the success case */
export function isApiSuccess<T>(
  result: ApiResult<T>,
): result is { ok: true; data: T } {
  return result.ok;
}
