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

import type { components } from "../schema";
import type { ApiErrorDetail, ApiFieldError } from "../types";

// ── Mutable config (overridable for tests) ────────────────────────────────────

/**
 * Base URL for the backend API.
 * Defaults to `import.meta.env.VITE_SERVER_URL` at module load time,
 * but can be overridden via `setBaseUrl()` for testing.
 * An empty string means same-origin: in dev the Vite proxy forwards `/api`
 * to the backend, so requests work from any device on the LAN.
 */
let baseUrl: string | undefined = import.meta.env.VITE_SERVER_URL as
  | string
  | undefined;

export function setBaseUrl(url: string | undefined): void {
  baseUrl = url;
}

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Paths that interact with authentication or are accessible without a valid session.
 * Requests to these paths skip the token freshness check so the user can reach the
 * auth flow when their token is expired.
 */
const NO_REFRESH_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/ping",
  "/api/status",
  "/api/version",
];

/** Buffer (ms) before token expiry to proactively refresh */
const REFRESH_BUFFER_MS = 60_000;

/** Shared promise to deduplicate concurrent refresh calls */
let refreshPromise: Promise<boolean> | null = null;

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
    cause instanceof Error ? cause.message : "Network request failed";
  return { code: "NETWORK_ERROR", message };
}

// ── User-facing error messages ───────────────────────────────────────────────

export const API_ERROR_CODES = {
  TIMEOUT: "TIMEOUT",
  NETWORK_ERROR: "NETWORK_ERROR",
  MISSING_CONFIG: "MISSING_CONFIG",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;

export const SERVER_WARMUP_MESSAGE =
  "Le serveur est en cours de démarrage et sera disponible dans quelques secondes. Veuillez réessayer.";

export const GENERIC_ERROR_MESSAGE = "Une erreur est survenue.";
const NETWORK_ERROR_MESSAGE =
  "Impossible de contacter le serveur. Vérifiez votre connexion Internet.";
const SERVER_ERROR_MESSAGE =
  "Le serveur a rencontré une erreur. Veuillez réessayer plus tard.";
const SESSION_EXPIRED_MESSAGE =
  "Votre session a expiré. Veuillez vous reconnecter.";

/**
 * Backend error codes mapped to French UI copy. The backend `message` is an
 * English diagnostic and is never shown to users; unknown codes fall back to
 * the generic message.
 *
 * Keep these codes in sync with the backend `ApiErrorCodes` class.
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Auth
  EMAIL_EXISTS: "Un compte existe déjà avec cette adresse email.",
  INVALID_EMAIL: "L'adresse email est invalide.",
  INVALID_CREDENTIALS: "Email ou mot de passe incorrect.",
  USER_DISABLED: "Ce compte est désactivé.",
  TOO_MANY_ATTEMPTS: "Trop de tentatives. Veuillez réessayer plus tard.",
  INVALID_REFRESH_TOKEN: SESSION_EXPIRED_MESSAGE,
  AUTH_FAILED: "L'authentification a échoué. Veuillez réessayer.",
  UNAUTHORIZED: SESSION_EXPIRED_MESSAGE,

  // General API
  VALIDATION_ERROR:
    "Certaines informations sont invalides. Vérifiez votre saisie.",
  NOT_FOUND: "L'élément demandé est introuvable.",
  BAD_REQUEST: "La demande n'a pas pu être traitée.",
  INVALID_OPERATION: "L'opération n'a pas pu être effectuée.",
  SERVICE_UNAVAILABLE:
    "Le service est temporairement indisponible. Veuillez réessayer dans quelques instants.",
  MENU_VERSION_CONFLICT:
    "Le menu a été modifié sur un autre appareil. Il a été actualisé.",
  INTERNAL_ERROR: SERVER_ERROR_MESSAGE,
  UNKNOWN_ERROR: SERVER_ERROR_MESSAGE,

  // Feedback
  VERSION_MISMATCH:
    "Mettez à jour l'application pour envoyer un signalement.",
  RATE_LIMITED: "Trop de signalements envoyés. Veuillez réessayer plus tard.",
  WEBHOOK_NOT_CONFIGURED:
    "Le signalement n'a pas pu être envoyé. Veuillez réessayer plus tard.",
  WEBHOOK_FAILED:
    "Le signalement n'a pas pu être envoyé. Veuillez réessayer plus tard.",

  // Transport
  NETWORK_ERROR: NETWORK_ERROR_MESSAGE,
  MISSING_CONFIG: "Le service est indisponible. Veuillez réessayer plus tard.",
};

function getHttpStatusMessage(code: string): string | undefined {
  const match = /^HTTP_(\d{3})$/.exec(code);
  if (!match) return undefined;

  const status = Number(match[1]);
  if (status === 401) return SESSION_EXPIRED_MESSAGE;
  if (status === 403)
    return "Vous n'avez pas l'autorisation d'effectuer cette action.";
  if (status === 404) return ERROR_MESSAGES.NOT_FOUND;
  if (status === 429)
    return "Trop de requêtes. Veuillez réessayer plus tard.";
  if (status >= 500) return SERVER_ERROR_MESSAGE;
  return undefined;
}

export function getApiErrorMessage(
  error: ApiErrorDetail,
  fallback = GENERIC_ERROR_MESSAGE,
): string {
  if (error.code === API_ERROR_CODES.TIMEOUT) return SERVER_WARMUP_MESSAGE;

  return ERROR_MESSAGES[error.code] ?? getHttpStatusMessage(error.code) ?? fallback;
}

export const SERVER_WARMUP_TOAST_DURATION_MS = 6000;

export function getApiErrorToastDuration(
  error: ApiErrorDetail,
): number | undefined {
  return error.code === API_ERROR_CODES.TIMEOUT
    ? SERVER_WARMUP_TOAST_DURATION_MS
    : undefined;
}

/** Whether a failed login was rejected because of the credentials themselves. */
export function isInvalidCredentialsError(error: ApiErrorDetail): boolean {
  return error.code === "INVALID_CREDENTIALS";
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

// ── Public request builders ──────────────────────────────────────────────────

export async function apiGet<T>(
  path: string,
  options?: { signal?: AbortSignal; params?: Record<string, string> },
): Promise<ApiResult<T>> {
  return request<T>("GET", path, undefined, options);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: { signal?: AbortSignal },
): Promise<ApiResult<T>> {
  return request<T>("POST", path, body, options);
}

export async function apiPut<T>(
  path: string,
  body: unknown,
  options?: { signal?: AbortSignal },
): Promise<ApiResult<T>> {
  return request<T>("PUT", path, body, options);
}

export async function apiDelete<T>(
  path: string,
  options?: { signal?: AbortSignal },
): Promise<ApiResult<T>> {
  return request<T>("DELETE", path, undefined, options);
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

/** Window event fired whenever the login state changes. */
export const AUTH_CHANGED_EVENT = "auth:changed";

/** Whether the current user is logged in (guest mode is not logged in). */
export function isLoggedIn(): boolean {
  try {
    return !!localStorage.getItem("user_id");
  } catch {
    // localStorage unavailable (e.g. in tests or SSR)
    return false;
  }
}

/** The current user's id, or null when not logged in. */
export function getCurrentUserId(): string | null {
  try {
    return localStorage.getItem("user_id");
  } catch {
    // localStorage unavailable (e.g. in tests or SSR)
    return null;
  }
}

/** Notify subscribers (e.g. hooks) that the login state may have changed. */
export function notifyAuthChange(): void {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuth(): void {
  try {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("token_expiry");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_username");
  } catch {
    // localStorage unavailable (e.g. in tests or SSR)
  }
  notifyAuthChange();
}

function redirectToLogin(): void {
  window.location.href = "/login";
}

/** Attempt to refresh the auth token via the refresh endpoint. */
async function doRefresh(): Promise<boolean> {
  let refreshToken: string | null;
  try {
    refreshToken = localStorage.getItem("refresh_token");
  } catch {
    // localStorage unavailable
    return false;
  }
  if (!refreshToken || baseUrl === undefined) return false;

  const baseUrlClean = baseUrl.replace(/\/+$/, "");

  try {
    const response = await fetch(`${baseUrlClean}/api/auth/refresh`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = (await response.json()) as components["schemas"]["RefreshResponse"];

    localStorage.setItem("auth_token", data.idToken);
    localStorage.setItem("refresh_token", data.refreshToken);
    localStorage.setItem(
      "token_expiry",
      String(Date.now() + Number(data.expiresIn) * 1000),
    );
    return true;
  } catch {
    // Network error — let the original request use the old token
    return true;
  }
}

/**
 * Check token freshness before a request; refresh if stale.
 * Concurrent calls share a single refresh promise.
 */
async function ensureValidToken(): Promise<boolean> {
  try {
    const expiry = localStorage.getItem("token_expiry");
    if (!expiry) return true;

    const timeUntilExpiry = Number(expiry) - Date.now();
    if (timeUntilExpiry > REFRESH_BUFFER_MS) return true;
  } catch {
    // localStorage unavailable (e.g. in tests or SSR)
    return true;
  }

  if (refreshPromise) return refreshPromise;

  refreshPromise = doRefresh();

  try {
    const ok = await refreshPromise;
    if (!ok) {
      clearAuth();
      redirectToLogin();
      return false;
    }
    return true;
  } finally {
    refreshPromise = null;
  }
}

// ── Core request function ────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { signal?: AbortSignal; params?: Record<string, string> },
): Promise<ApiResult<T>> {
  if (baseUrl === undefined) {
    return {
      ok: false,
      error: {
        code: "MISSING_CONFIG",
        message:
          "VITE_SERVER_URL is not set. " +
          "Create a .env file with VITE_SERVER_URL=http://localhost:5126, " +
          "or leave it empty to use the dev proxy.",
      },
    };
  }

  let url = `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  if (options?.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  // Ensure a fresh token for authenticated requests
  if (!NO_REFRESH_PATHS.includes(path)) {
    const valid = await ensureValidToken();
    if (!valid) {
      return {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Session expired" },
      };
    }
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
        error: { code: API_ERROR_CODES.TIMEOUT, message: "Request timed out" },
      };
    }

    return { ok: false, error: buildNetworkError(err) };
  }
}

// ── Utility: combine two AbortSignals into one ───────────────────────────────

/** @internal Reset module-level refresh state. Only for use in tests. */
export function _resetRefreshState(): void {
  refreshPromise = null;
}

function combineAbortSignals(s1: AbortSignal, s2: AbortSignal): AbortSignal {
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
