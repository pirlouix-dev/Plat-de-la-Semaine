/**
 * Base API client for "Plat de la Semaine"
 *
 * Provides a thin wrapper around the Fetch API with:
 * - Base URL from VITE_SERVER_URL environment variable
 * - JSON content type by default
 * - Structured error handling
 * - Request/response logging in development
 *
 * ## Testing
 *
 * Use `setBaseUrl(url)` before each test to control the base URL.
 * Mock `globalThis.fetch` to simulate API responses.
 */

import type {
  ApiErrorDetail,
  ApiFieldError,
} from "../types";

// ── Mutable config (overridable for tests) ────────────────────────────────────

/**
 * Base URL for the backend API.
 * Defaults to `import.meta.env.VITE_SERVER_URL` at module load time,
 * but can be overridden via `setBaseUrl()` for testing.
 */
let baseUrl: string | undefined = import.meta.env.VITE_SERVER_URL as
  | string
  | undefined;

/**
 * Override the API base URL. Useful in tests.
 * Pass `undefined` to explicitly unset the base URL.
 */
export function setBaseUrl(url: string | undefined): void {
  baseUrl = url;
}

/** Default request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 15_000;

// ── Public types ─────────────────────────────────────────────────────────────

/**
 * The shape returned by every API call.
 * Use the type guards `isApiSuccess` / `isApiError` from `../types` to narrow.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorDetail };

// ── Internal helpers ─────────────────────────────────────────────────────────

function buildErrorDetail(status: number, body: unknown): ApiErrorDetail {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.code === "string" || typeof b.message === "string") {
      return {
        code: (b.code as string) ?? "UNKNOWN",
        message: (b.message as string) ?? `HTTP ${status}`,
        details: Array.isArray(b.details)
          ? (b.details as ApiFieldError[])
          : undefined,
      };
    }
  }
  return { code: `HTTP_${status}`, message: `HTTP ${status}` };
}

function buildNetworkError(cause: unknown): ApiErrorDetail {
  const message =
    cause instanceof Error
      ? cause.message
      : "Network request failed";
  return { code: "NETWORK_ERROR", message };
}

async function parseJsonSafe(
  res: Response
): Promise<unknown> {
  try {
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

// ── Public request builders ──────────────────────────────────────────────────

/** Perform a GET request */
export async function apiGet<T>(
  path: string,
  options?: { signal?: AbortSignal; params?: Record<string, string> }
): Promise<ApiResult<T>> {
  return request<T>("GET", path, undefined, options);
}

/** Perform a POST request with an optional JSON body */
export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: { signal?: AbortSignal }
): Promise<ApiResult<T>> {
  return request<T>("POST", path, body, options);
}

/** Perform a PUT request with a JSON body */
export async function apiPut<T>(
  path: string,
  body: unknown,
  options?: { signal?: AbortSignal }
): Promise<ApiResult<T>> {
  return request<T>("PUT", path, body, options);
}

/** Perform a DELETE request */
export async function apiDelete<T>(
  path: string,
  options?: { signal?: AbortSignal }
): Promise<ApiResult<T>> {
  return request<T>("DELETE", path, undefined, options);
}

// ── Core request function ────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { signal?: AbortSignal; params?: Record<string, string> }
): Promise<ApiResult<T>> {
  if (!baseUrl) {
    return {
      ok: false,
      error: {
        code: "MISSING_CONFIG",
        message:
          "VITE_SERVER_URL is not set. " +
          "Create a .env file with VITE_SERVER_URL=http://localhost:5126",
      },
    };
  }

  let url = `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  if (options?.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Combine caller signal (if any) with our timeout signal
  const combinedSignal = options?.signal
    ? combineAbortSignals(options.signal, controller.signal)
    : controller.signal;

  try {
    const headers: Record<string, string> = {
      accept: "application/json",
    };

    try {
      const token = localStorage.getItem("auth_token");
      if (token) {
        headers["authorization"] = `Bearer ${token}`;
      }
    } catch {
      // localStorage unavailable (e.g. in tests or SSR)
    }

    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);

    // 204 No Content — empty success
    if (response.status === 204) {
      return { ok: true, data: undefined as T };
    }

    const responseBody = await parseJsonSafe(response);

    if (!response.ok) {
      return {
        ok: false,
        error: buildErrorDetail(response.status, responseBody),
      };
    }

    return { ok: true, data: responseBody as T };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    // AbortError is expected when our timeout fires
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        ok: false,
        error: { code: "TIMEOUT", message: "Request timed out" },
      };
    }

    return { ok: false, error: buildNetworkError(err) };
  }
}

// ── Utility: combine two AbortSignals into one ───────────────────────────────

function combineAbortSignals(
  s1: AbortSignal,
  s2: AbortSignal
): AbortSignal {
  const controller = new AbortController();

  const onAbort = () => controller.abort();
  s1.addEventListener("abort", onAbort, { once: true });
  s2.addEventListener("abort", onAbort, { once: true });

  // If either is already aborted, abort immediately
  if (s1.aborted || s2.aborted) {
    controller.abort();
  }

  return controller.signal;
}
