import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getVersionInfo, submitFeedback } from "../services/settingsService";
import { setBaseUrl } from "../services/api";
import type { VersionInfo } from "../services/settingsService";

// ── Test data ────────────────────────────────────────────────────────────────

const FAKE_BASE_URL = "http://test.local:5126";

const SAMPLE_VERSION_INFO: VersionInfo = {
  latestVersion: "2.0.0",
  description: "New features and bug fixes",
  downloadUrl: "https://example.com/download/v2.0.0",
};

// ── Mock helpers ─────────────────────────────────────────────────────────────

function mockFetchResponse(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(body),
    } as Response)
  );
}

// ── Setup ────────────────────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────────────

describe("getVersionInfo", () => {
  it("returns version info on success", async () => {
    mockFetchResponse(200, SAMPLE_VERSION_INFO);

    const result = await getVersionInfo();
    expect(result).toEqual({ ok: true, data: SAMPLE_VERSION_INFO });
  });

  it("calls GET /api/version", async () => {
    mockFetchResponse(200, SAMPLE_VERSION_INFO);

    await getVersionInfo();
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    const options = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;

    expect(url).toBe(`${FAKE_BASE_URL}/api/version`);
    expect(options.method ?? "GET").toBe("GET");
  });

  it("propagates API errors", async () => {
    mockFetchResponse(503, {
      code: "SERVICE_UNAVAILABLE",
      message: "Service temporarily unavailable",
    });

    const result = await getVersionInfo();
    expect(result).toEqual({
      ok: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Service temporarily unavailable",
      },
    });
  });

  it("handles minimal version info response", async () => {
    // Backend should always return all fields, but handle gracefully
    const minimal = { latestVersion: "1.0.0", description: "", downloadUrl: "" };
    mockFetchResponse(200, minimal);

    const result = await getVersionInfo();
    expect(result).toEqual({ ok: true, data: minimal });
  });
});

describe("submitFeedback", () => {
  it("submits feedback successfully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      } as Response)
    );

    const result = await submitFeedback({ message: "Great app!" });
    expect(result).toEqual({ ok: true, data: {} });
  });

  it("calls POST /api/feedback with message body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      } as Response)
    );

    await submitFeedback({ message: "Bug report: crash on menu" });
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    const options = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;

    expect(url).toBe(`${FAKE_BASE_URL}/api/feedback`);
    expect(options.method).toBe("POST");
    expect(options.body).toBe(
      JSON.stringify({ message: "Bug report: crash on menu" })
    );
    expect(options.headers).toHaveProperty("content-type", "application/json");
  });

  it("propagates validation errors on long message", async () => {
    mockFetchResponse(400, {
      code: "VALIDATION_ERROR",
      message: "Message exceeds maximum length",
      details: [
        {
          field: "message",
          message: "Message must be at most 2000 characters",
        },
      ],
    });

    const result = await submitFeedback({
      message: "x".repeat(2001),
    });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Message exceeds maximum length",
        details: [
          {
            field: "message",
            message: "Message must be at most 2000 characters",
          },
        ],
      },
    });
  });

  it("handles rate limiting (429)", async () => {
    mockFetchResponse(429, {
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
    });

    const result = await submitFeedback({ message: "spam" });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    });
  });
});
