import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  setBaseUrl,
  _resetRefreshState,
  isLoggedIn,
  clearAuth,
  AUTH_CHANGED_EVENT,
  getApiErrorMessage,
  getApiErrorToastDuration,
  SERVER_WARMUP_MESSAGE,
  SERVER_WARMUP_TOAST_DURATION_MS,
} from "../services/api";
import type { ApiResult } from "../services/api";

// ── Mock setup ───────────────────────────────────────────────────────────────

const FAKE_BASE_URL = "http://test.local:5126";

beforeEach(() => {
  setBaseUrl(FAKE_BASE_URL);
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  setBaseUrl(undefined);
  _resetRefreshState();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Stub the global `fetch` to return a canned JSON response. */
function mockFetch(
  status: number,
  body: unknown,
  statusText?: string
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: statusText ?? "",
      json: vi.fn().mockResolvedValue(body),
    } as unknown as Response)
  );
}

/** Assert that fetch was called with the expected method, URL, and optional body. */
function expectFetchCalled(
  method: string,
  path: string,
  body?: unknown
): void {
  const expectedUrl = `${FAKE_BASE_URL}${path}`;
  const fetchMock = vi.mocked(fetch);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

  expect(url).toBe(expectedUrl);
  expect(options.method ?? "GET").toBe(method);

  if (body !== undefined) {
    expect(options.headers).toHaveProperty("content-type", "application/json");
    expect(options.body).toBe(JSON.stringify(body));
  } else if (method !== "GET") {
    // POST/PUT/DELETE may or may not have a body; check only content-type absence
    expect(options.body).toBeUndefined();
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("apiGet", () => {
  it("performs a GET request and returns the response data", async () => {
    mockFetch(200, { items: ["a", "b"] });

    const result = await apiGet<string[]>("/api/test");
    expect(result).toEqual({ ok: true, data: { items: ["a", "b"] } });
    expectFetchCalled("GET", "/api/test");
  });

  it("handles 404 errors", async () => {
    mockFetch(404, { code: "NOT_FOUND", message: "Resource not found" });

    const result = await apiGet("/api/test");
    expect(result).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Resource not found" },
    });
  });

  it("handles network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network failure"))
    );

    const result = await apiGet("/api/test");
    expect(result).toEqual({
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Network failure" },
    });
  });

  it("handles empty response body on 204", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: vi.fn().mockRejectedValue(new Error("No body")),
      } as unknown as Response)
    );

    const result = await apiGet<void>("/api/empty");
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

describe("apiPost", () => {
  it("performs a POST request with a JSON body", async () => {
    mockFetch(201, { id: "new-id" });
    const body = { name: "Test", course: 1 };

    const result = await apiPost("/api/dishes", body);
    expect(result).toEqual({ ok: true, data: { id: "new-id" } });
    expectFetchCalled("POST", "/api/dishes", body);
  });

  it("performs a POST request without a body", async () => {
    mockFetch(200, { ok: true });

    const result = await apiPost("/api/action", undefined);
    expect(result).toEqual({ ok: true, data: { ok: true } });
    expectFetchCalled("POST", "/api/action");
  });

  it("handles 400 validation errors", async () => {
    mockFetch(400, {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: [
        { field: "name", message: "Name is required" },
      ],
    });

    const result = await apiPost("/api/dishes", {});
    expect(result).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: [{ field: "name", message: "Name is required" }],
      },
    });
  });

  it("handles 500 server errors with generic message", async () => {
    mockFetch(500, null);

    const result = await apiPost("/api/dishes", {});
    expect(result).toEqual({
      ok: false,
      error: { code: "HTTP_500", message: "HTTP 500" },
    });
  });
});

describe("apiPut", () => {
  it("performs a PUT request with a JSON body", async () => {
    mockFetch(200, { id: "d1", name: "Updated" });
    const body = { name: "Updated" };

    const result = await apiPut("/api/dishes/d1", body);
    expect(result).toEqual({ ok: true, data: { id: "d1", name: "Updated" } });
    expectFetchCalled("PUT", "/api/dishes/d1", body);
  });
});

describe("apiDelete", () => {
  it("performs a DELETE request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: vi.fn().mockRejectedValue(new Error("No body")),
      } as unknown as Response)
    );

    const result = await apiDelete<void>("/api/dishes/d1");
    expect(result).toEqual({ ok: true, data: undefined });
    expectFetchCalled("DELETE", "/api/dishes/d1");
  });
});

describe("URL construction", () => {
  it("removes trailing slash from base URL", async () => {
    setBaseUrl("http://test.local:5126/");
    mockFetch(200, {});

    await apiGet("/api/test");
    const fetchMock = vi.mocked(fetch);
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toBe("http://test.local:5126/api/test");
  });

  it("removes leading slash from path", async () => {
    setBaseUrl("http://test.local:5126");
    mockFetch(200, {});

    await apiGet("api/test");
    const fetchMock = vi.mocked(fetch);
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toBe("http://test.local:5126/api/test");
  });
});

describe("relative base URL", () => {
  it("uses a same-origin path when the base URL is empty", async () => {
    setBaseUrl("");
    mockFetch(200, {});

    await apiGet("/api/test");
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toBe("/api/test");
  });

  it("refreshes via a relative URL when the base URL is empty", async () => {
    setBaseUrl("");
    localStorage.setItem("token_expiry", "0");
    localStorage.setItem("auth_token", "old-token");
    localStorage.setItem("refresh_token", "refresh-abc");

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            idToken: "new-token",
            refreshToken: "new-refresh",
            expiresIn: "3600",
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ ok: true }),
        } as unknown as Response),
    );

    const result = await apiGet("/api/test");

    expect(result).toEqual({ ok: true, data: { ok: true } });
    const refreshUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(refreshUrl).toBe("/api/auth/refresh");
    expect(localStorage.getItem("auth_token")).toBe("new-token");
  });
});

describe("Error handling edge cases", () => {
  it("returns MISSING_CONFIG when no base URL is set", async () => {
    setBaseUrl(undefined);

    const result = await apiGet("/api/test");
    expect(result).toEqual({
      ok: false,
      error: {
        code: "MISSING_CONFIG",
        message: expect.stringContaining("VITE_SERVER_URL"),
      },
    });
  });

  it("handles abort/timeout gracefully", async () => {
    // Simulate abort by rejecting with AbortError
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(
        new DOMException("The operation was aborted", "AbortError")
      )
    );

    const result = await apiGet("/api/test");
    expect(result).toEqual({
      ok: false,
      error: { code: "TIMEOUT", message: "Request timed out" },
    });
  });

  it("handles non-Error rejection (e.g., string)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue("something went wrong")
    );

    const result = await apiGet("/api/test");
    expect(result).toEqual({
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Network request failed" },
    });
  });

  it("handles error response without standard error shape", async () => {
    mockFetch(403, { arbitrary: "data" });

    const result = await apiGet("/api/test");
    expect(result).toEqual({
      ok: false,
      error: { code: "HTTP_403", message: "HTTP 403" },
    });
  });

  it("handles error response where json() throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: vi.fn().mockRejectedValue(new Error("parse error")),
      } as unknown as Response)
    );

    const result = await apiGet("/api/test");
    expect(result).toEqual({
      ok: false,
      error: { code: "HTTP_502", message: "HTTP 502" },
    });
  });
});

describe("getApiErrorMessage", () => {
  it("returns the warm-up message for a TIMEOUT error", () => {
    expect(
      getApiErrorMessage({ code: "TIMEOUT", message: "Request timed out" })
    ).toBe(SERVER_WARMUP_MESSAGE);
  });

  it.each([
    ["EMAIL_EXISTS", "Un compte existe déjà avec cette adresse email."],
    ["INVALID_CREDENTIALS", "Email ou mot de passe incorrect."],
    ["USER_DISABLED", "Ce compte est désactivé."],
    ["TOO_MANY_ATTEMPTS", "Trop de tentatives. Veuillez réessayer plus tard."],
    [
      "VALIDATION_ERROR",
      "Certaines informations sont invalides. Vérifiez votre saisie.",
    ],
    ["NOT_FOUND", "L'élément demandé est introuvable."],
    [
      "SERVICE_UNAVAILABLE",
      "Le service est temporairement indisponible. Veuillez réessayer dans quelques instants.",
    ],
    [
      "RATE_LIMITED",
      "Trop de signalements envoyés. Veuillez réessayer plus tard.",
    ],
    [
      "NETWORK_ERROR",
      "Impossible de contacter le serveur. Vérifiez votre connexion Internet.",
    ],
  ])("maps %s to French copy", (code, expected) => {
    expect(getApiErrorMessage({ code, message: "diagnostic" })).toBe(expected);
  });

  it("ignores the backend diagnostic message", () => {
    expect(
      getApiErrorMessage({
        code: "VALIDATION_ERROR",
        message: "Name must not exceed 200 characters.",
      })
    ).toBe("Certaines informations sont invalides. Vérifiez votre saisie.");
  });

  it("maps HTTP status codes to French copy", () => {
    expect(getApiErrorMessage({ code: "HTTP_500", message: "HTTP 500" })).toBe(
      "Le serveur a rencontré une erreur. Veuillez réessayer plus tard."
    );
    expect(getApiErrorMessage({ code: "HTTP_404", message: "HTTP 404" })).toBe(
      "L'élément demandé est introuvable."
    );
  });

  it("falls back to a generic French message for unknown codes", () => {
    expect(
      getApiErrorMessage({ code: "SOMETHING_NEW", message: "SOMETHING_NEW" })
    ).toBe("Une erreur est survenue.");
  });
});

describe("getApiErrorToastDuration", () => {
  it("extends the duration for a TIMEOUT error", () => {
    expect(
      getApiErrorToastDuration({ code: "TIMEOUT", message: "Request timed out" })
    ).toBe(SERVER_WARMUP_TOAST_DURATION_MS);
  });

  it("uses the default duration for other error codes", () => {
    expect(
      getApiErrorToastDuration({ code: "INVALID_CREDENTIALS", message: "nope" })
    ).toBeUndefined();
  });
});

describe("AbortSignal forwarding", () => {
  it("passes signal through to fetch", async () => {
    mockFetch(200, {});
    const controller = new AbortController();

    await apiGet("/api/test", { signal: controller.signal });

    const fetchMock = vi.mocked(fetch);
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.signal).toBeDefined();
  });
});

// ── Token refresh behaviour ───────────────────────────────────────────────────

describe("token refresh", () => {
  function mockRefreshResponse(ok: boolean, body?: unknown): Response {
    return {
      ok,
      status: ok ? 200 : 401,
      json: vi.fn().mockResolvedValue(body ?? {}),
    } as unknown as Response;
  }

  function mockRequestResponse(body: unknown) {
    return {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(body),
    } as unknown as Response;
  }

  it("skips refresh when token is still valid", async () => {
    localStorage.setItem("token_expiry", String(Date.now() + 120_000));
    localStorage.setItem("auth_token", "still-valid");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockRequestResponse({ ok: true })),
    );

    const result = await apiGet("/api/test");
    expect(result).toEqual({ ok: true, data: { ok: true } });
    // Only one fetch call — no refresh
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes token when expired and proceeds with the request", async () => {
    localStorage.setItem("token_expiry", "0");
    localStorage.setItem("auth_token", "old-token");
    localStorage.setItem("refresh_token", "refresh-abc");

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          mockRefreshResponse(true, {
            idToken: "new-token",
            refreshToken: "new-refresh",
            expiresIn: "3600",
          }),
        )
        .mockResolvedValueOnce(mockRequestResponse({ ok: true })),
    );

    const result = await apiGet("/api/test");
    expect(result).toEqual({ ok: true, data: { ok: true } });

    // Tokens updated
    expect(localStorage.getItem("auth_token")).toBe("new-token");
    expect(localStorage.getItem("refresh_token")).toBe("new-refresh");

    const newExpiry = Number(localStorage.getItem("token_expiry"));
    expect(newExpiry).toBeGreaterThan(Date.now());
  });

  it("clears auth and redirects when refresh is rejected", async () => {
    localStorage.setItem("token_expiry", "0");
    localStorage.setItem("auth_token", "old-token");
    localStorage.setItem("refresh_token", "bad-refresh");
    localStorage.setItem("user_id", "user-42");
    localStorage.setItem("user_username", "Mathéo");

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          mockRefreshResponse(false, { code: "UNAUTHORIZED" }),
        ),
    );

    const result = await apiGet("/api/test");

    // Auth data cleared
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(localStorage.getItem("token_expiry")).toBeNull();
    expect(localStorage.getItem("user_id")).toBeNull();
    expect(localStorage.getItem("user_username")).toBeNull();

    // Error returned
    expect(result).toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Session expired" },
    });
  });

  it("proceeds normally when no token_expiry is stored", async () => {
    localStorage.setItem("auth_token", "some-token");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockRequestResponse({ ok: true })),
    );

    const result = await apiGet("/api/test");
    expect(result).toEqual({ ok: true, data: { ok: true } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("skips refresh check for unauthenticated paths", async () => {
    localStorage.setItem("token_expiry", "0");
    localStorage.setItem("auth_token", "old-token");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockRequestResponse({ ok: true })),
    );

    await apiPost("/api/auth/login", { email: "a@b.com", password: "pw" });

    // Only one fetch call — no refresh attempt
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("only calls refresh once for concurrent requests", async () => {
    localStorage.setItem("token_expiry", "0");
    localStorage.setItem("auth_token", "old-token");
    localStorage.setItem("refresh_token", "refresh-abc");

    // One refresh + any number of actual requests
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        mockRefreshResponse(true, {
          idToken: "new-token",
          refreshToken: "new-refresh",
          expiresIn: "3600",
        }),
      )
      .mockResolvedValue(mockRequestResponse({ ok: true }));

    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      apiGet("/api/a"),
      apiGet("/api/b"),
      apiGet("/api/c"),
    ]);

    // 1 refresh + 3 actual requests = 4 total calls
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("recovers from network error during refresh", async () => {
    localStorage.setItem("token_expiry", "0");
    localStorage.setItem("auth_token", "old-token");
    localStorage.setItem("refresh_token", "refresh-abc");

    // First call (refresh) throws network error
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("Network error"))
      // Second call (actual request) succeeds
      .mockResolvedValueOnce(mockRequestResponse({ ok: true }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await apiGet("/api/test");
    expect(result).toEqual({ ok: true, data: { ok: true } });

    // Auth data preserved (not cleared)
    expect(localStorage.getItem("auth_token")).toBe("old-token");
    expect(localStorage.getItem("refresh_token")).toBe("refresh-abc");
  });
});

// ── Auth state helpers ───────────────────────────────────────────────────────

describe("isLoggedIn", () => {
  it("returns false when no user is stored", () => {
    expect(isLoggedIn()).toBe(false);
  });

  it("returns true when a user_id is stored", () => {
    localStorage.setItem("user_id", "user-42");
    expect(isLoggedIn()).toBe(true);
  });
});

describe("clearAuth", () => {
  it("dispatches the auth-changed event", () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_CHANGED_EVENT, listener);
    localStorage.setItem("user_id", "user-42");

    clearAuth();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_CHANGED_EVENT, listener);
  });
});

// ── Type-level sanity (compile-time checks, no runtime effect) ───────────────

describe("ApiResult type compatibility", () => {
  it("ApiResult<void> works for 204 responses", async () => {
    // Compile-time check: this should not error
    const result: ApiResult<void> = { ok: true, data: undefined };
    expect(result.ok).toBe(true);
  });

  it("ApiResult<number[]> works for array responses", async () => {
    const result: ApiResult<number[]> = { ok: true, data: [1, 2, 3] };
    expect(result.data).toHaveLength(3);
  });

  it("ApiResult with error is discriminated properly", () => {
    const err: ApiResult<string> = {
      ok: false,
      error: { code: "ERR", message: "fail" },
    };
    if (!err.ok) {
      expect(err.error.message).toBe("fail");
    }
  });
});
