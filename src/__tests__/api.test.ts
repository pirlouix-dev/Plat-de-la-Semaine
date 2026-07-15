import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiGet, apiPost, apiPut, apiDelete, setBaseUrl } from "../services/api";
import type { ApiResult } from "../services/api";

// ── Mock setup ───────────────────────────────────────────────────────────────

const FAKE_BASE_URL = "http://test.local:5126";

beforeEach(() => {
  setBaseUrl(FAKE_BASE_URL);
  vi.useFakeTimers();
});

afterEach(() => {
  setBaseUrl(undefined);
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
    } as Response)
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
