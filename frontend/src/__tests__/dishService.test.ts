import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getDishes,
  createDish,
  updateDish,
  deleteDish,
  applyDishBatch,
} from "../services/dishService";
import { setBaseUrl } from "../services/api";
import type {
  Dish,
  CreateDishPayload,
  UpdateDishPayload,
  DishBatchPayload,
} from "../types";
import { Course, Season } from "../types";

// ── Test data ────────────────────────────────────────────────────────────────

const SAMPLE_DISH: Dish = {
  id: "dish-1",
  userId: "user-1",
  name: "Spaghetti Carbonara",
  description: "A classic Italian pasta dish",
  course: Course.Main,
  seasons: [Season.Spring, Season.Summer],
  updatedAt: "2026-07-14T17:48:00Z",
  isDeleted: false,
};

const SAMPLE_DISH_2: Dish = {
  id: "dish-2",
  userId: "user-1",
  name: "Salade Niçoise",
  description: "Fresh salad from Nice",
  course: Course.Starter,
  seasons: [Season.Summer],
  updatedAt: "2026-07-14T17:48:00Z",
  isDeleted: false,
};

const FAKE_BASE_URL = "http://test.local:5126";

// ── Mock helpers ─────────────────────────────────────────────────────────────

function mockFetchResponse(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(body),
    } as unknown as Response)
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

describe("getDishes", () => {
  it("returns a list of dishes on success", async () => {
    const backendResponse = {
      data: [SAMPLE_DISH, SAMPLE_DISH_2],
      total: 2,
    };
    mockFetchResponse(200, backendResponse);

    const result = await getDishes();
    expect(result).toEqual({ ok: true, data: [SAMPLE_DISH, SAMPLE_DISH_2] });
  });

  it("returns an empty array when no dishes exist", async () => {
    mockFetchResponse(200, { data: [], total: 0 });

    const result = await getDishes();
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("propagates API errors", async () => {
    mockFetchResponse(500, {
      code: "SERVER_ERROR",
      message: "Internal server error",
    });

    const result = await getDishes();
    expect(result).toEqual({
      ok: false,
      error: { code: "SERVER_ERROR", message: "Internal server error" },
    });
  });

  it("sends since query parameter when provided", async () => {
    mockFetchResponse(200, { data: [SAMPLE_DISH], total: 1 });

    const since = "2026-07-20T00:00:00.000Z";
    const result = await getDishes({ since });
    expect(result).toEqual({ ok: true, data: [SAMPLE_DISH] });

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("since=2026-07-20T00%3A00%3A00.000Z");
  });

  it("omits since query parameter when not provided", async () => {
    mockFetchResponse(200, { data: [SAMPLE_DISH], total: 1 });

    await getDishes();

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).not.toContain("since=");
  });
});

describe("createDish", () => {
  it("creates a dish and returns it", async () => {
    const payload: CreateDishPayload = {
      name: "Tarte aux pommes",
      course: Course.Dessert,
      seasons: [Season.Autumn, Season.Winter],
      description: "Une tarte aux pommes maison",
    };
    const createdDish: Dish = {
      ...SAMPLE_DISH,
      id: "new-dish-1",
      name: "Tarte aux pommes",
      course: Course.Dessert,
      seasons: [Season.Autumn, Season.Winter],
      description: "Une tarte aux pommes maison",
      updatedAt: "2026-07-15T12:00:00Z",
    };
    mockFetchResponse(201, { data: createdDish });

    const result = await createDish(payload);

    expect(result).toEqual({ ok: true, data: createdDish });
    // Verify the body was sent correctly
    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string
    );
    expect(callBody).toEqual(payload);
  });

  it("propagates validation errors", async () => {
    const payload: CreateDishPayload = {
      name: "",
      course: Course.Main,
      seasons: [],
    };
    mockFetchResponse(400, {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: [
        { field: "name", message: "Name is required" },
        { field: "seasons", message: "At least one season is required" },
      ],
    });

    const result = await createDish(payload);
    expect(result).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: [
          { field: "name", message: "Name is required" },
          { field: "seasons", message: "At least one season is required" },
        ],
      },
    });
  });
});

describe("updateDish", () => {
  it("updates a dish and returns it", async () => {
    const payload: UpdateDishPayload = { name: "Carbonara revisitée" };
    const updatedDish: Dish = {
      ...SAMPLE_DISH,
      name: "Carbonara revisitée",
      updatedAt: "2026-07-15T12:00:00Z",
    };
    mockFetchResponse(200, { data: updatedDish });

    const result = await updateDish("dish-1", payload);

    expect(result).toEqual({ ok: true, data: updatedDish });
    // Verify URL encodes the ID
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toBe(`${FAKE_BASE_URL}/api/dishes/dish-1`);
  });

  it("propagates not-found errors", async () => {
    mockFetchResponse(404, {
      code: "NOT_FOUND",
      message: "Dish not found",
    });

    const result = await updateDish("nonexistent", {
      name: "Ghost dish",
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Dish not found" },
    });
  });
});

describe("deleteDish", () => {
  it("deletes a dish successfully (204)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: vi.fn().mockRejectedValue(new Error("No body")),
      } as unknown as Response)
    );

    const result = await deleteDish("dish-1");
    expect(result).toEqual({ ok: true, data: undefined });

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toBe(`${FAKE_BASE_URL}/api/dishes/dish-1`);
    const options = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(options.method).toBe("DELETE");
  });

  it("encodes special characters in dish ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: vi.fn().mockRejectedValue(new Error("No body")),
      } as unknown as Response)
    );

    await deleteDish("dish/with/slashes");

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toBe(`${FAKE_BASE_URL}/api/dishes/dish%2Fwith%2Fslashes`);
  });
});

describe("applyDishBatch", () => {
  const payload: DishBatchPayload = {
    operations: [
      {
        op: "create",
        id: "local-1",
        name: "Ratatouille",
        description: "Légumes mijotés",
        course: Course.Main,
        seasons: [Season.Summer],
      },
      { op: "delete", id: "dish-2" },
    ],
  };

  it("posts the operations to the batch endpoint and returns the per-operation results", async () => {
    const response = {
      created: 1,
      updated: 0,
      deleted: 1,
      failed: 0,
      results: [
        {
          index: 0,
          op: "create",
          status: "created",
          id: "local-1",
          data: SAMPLE_DISH,
        },
        { index: 1, op: "delete", status: "deleted", id: "dish-2" },
      ],
    };
    mockFetchResponse(200, response);

    const result = await applyDishBatch(payload);

    expect(result).toEqual({ ok: true, data: response });

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toBe(`${FAKE_BASE_URL}/api/dishes/batch`);
    const options = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual(payload);
  });

  it("propagates API errors", async () => {
    mockFetchResponse(400, {
      code: "VALIDATION_ERROR",
      message: "Invalid payload",
    });

    const result = await applyDishBatch(payload);

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid payload" },
    });
  });
});


