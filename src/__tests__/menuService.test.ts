import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMenu, saveMenu } from "../services/menuService";
import { setBaseUrl } from "../services/api";

const FAKE_BASE_URL = "http://test.local:5126";

function mockFetchResponse(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(body),
    } as unknown as Response),
  );
}

beforeEach(() => {
  setBaseUrl(FAKE_BASE_URL);
});

afterEach(() => {
  setBaseUrl(undefined);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getMenu", () => {
  it("returns the saved menu", async () => {
    const saved = {
      selectedDishIds: ["d1", "d2"],
      updatedAt: "2026-08-01T00:00:00Z",
    };
    mockFetchResponse(200, { data: saved });

    const result = await getMenu();

    expect(result).toEqual({ ok: true, data: saved });
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toBe(`${FAKE_BASE_URL}/api/menu`);
  });

  it("returns an empty menu when none was saved", async () => {
    const saved = { selectedDishIds: [], updatedAt: null };
    mockFetchResponse(200, { data: saved });

    const result = await getMenu();

    expect(result).toEqual({ ok: true, data: saved });
  });

  it("propagates API errors", async () => {
    mockFetchResponse(401, {
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });

    const result = await getMenu();

    expect(result).toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    });
  });
});

describe("saveMenu", () => {
  it("PUTs the selection and the expected version", async () => {
    const payload = {
      selectedDishIds: ["d1"],
      expectedUpdatedAt: "2026-07-01T00:00:00Z",
    };
    const stored = {
      selectedDishIds: ["d1"],
      updatedAt: "2026-08-01T00:00:00Z",
    };
    mockFetchResponse(200, { data: stored });

    const result = await saveMenu(payload);

    expect(result).toEqual({ ok: true, data: stored });

    const options = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body as string)).toEqual(payload);
  });

  it("propagates validation errors", async () => {
    mockFetchResponse(400, {
      code: "VALIDATION_ERROR",
      message: "Invalid payload",
    });

    const result = await saveMenu({
      selectedDishIds: [],
      expectedUpdatedAt: null,
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid payload" },
    });
  });
});
