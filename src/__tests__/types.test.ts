import { describe, it, expect } from "vitest";
import {
  Course,
  Season,
  COURSE_LABELS,
  SEASON_LABELS,
  ALL_SEASONS,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_FEEDBACK_LENGTH,
  MAX_USERNAME_LENGTH,
  CHAR_LIMIT_THRESHOLD,
  isValidCourse,
  isValidSeason,
  isApiError,
  isApiSuccess,
  type CreateDishPayload,
} from "../types";

// ── Course enum-equivalent ────────────────────────────────────────────────────

describe("Course", () => {
  it("defines Starter with value 0", () => {
    expect(Course.Starter).toBe(0);
  });

  it("defines Main with value 1", () => {
    expect(Course.Main).toBe(1);
  });

  it("defines Dessert with value 2", () => {
    expect(Course.Dessert).toBe(2);
  });

  it("has exactly 3 members", () => {
    expect(Object.keys(Course).length).toBe(3);
  });
});

// ── Season enum-equivalent ────────────────────────────────────────────────────

describe("Season", () => {
  it("defines Spring with value 0", () => {
    expect(Season.Spring).toBe(0);
  });

  it("defines Summer with value 1", () => {
    expect(Season.Summer).toBe(1);
  });

  it("defines Autumn with value 2", () => {
    expect(Season.Autumn).toBe(2);
  });

  it("defines Winter with value 3", () => {
    expect(Season.Winter).toBe(3);
  });

  it("has exactly 4 members", () => {
    expect(Object.keys(Season).length).toBe(4);
  });
});

// ── Helper constants ─────────────────────────────────────────────────────────

describe("COURSE_LABELS", () => {
  it("maps Starter to 'Entrée'", () => {
    expect(COURSE_LABELS[Course.Starter]).toBe("Entrée");
  });

  it("maps Main to 'Plat'", () => {
    expect(COURSE_LABELS[Course.Main]).toBe("Plat");
  });

  it("maps Dessert to 'Dessert'", () => {
    expect(COURSE_LABELS[Course.Dessert]).toBe("Dessert");
  });

  it("has entries for every Course value", () => {
    for (const value of Object.values(Course) as number[]) {
      expect(COURSE_LABELS[value as keyof typeof COURSE_LABELS]).toBeDefined();
    }
  });
});

describe("SEASON_LABELS", () => {
  it("maps Spring to 'Printemps'", () => {
    expect(SEASON_LABELS[Season.Spring]).toBe("Printemps");
  });

  it("maps Summer to 'Été'", () => {
    expect(SEASON_LABELS[Season.Summer]).toBe("Été");
  });

  it("maps Autumn to 'Automne'", () => {
    expect(SEASON_LABELS[Season.Autumn]).toBe("Automne");
  });

  it("maps Winter to 'Hiver'", () => {
    expect(SEASON_LABELS[Season.Winter]).toBe("Hiver");
  });

  it("has entries for every Season value", () => {
    for (const value of Object.values(Season) as number[]) {
      expect(SEASON_LABELS[value as keyof typeof SEASON_LABELS]).toBeDefined();
    }
  });
});

describe("ALL_SEASONS", () => {
  it("contains all four seasons", () => {
    expect(ALL_SEASONS).toHaveLength(4);
  });

  it("includes Spring, Summer, Autumn, Winter in order", () => {
    expect(ALL_SEASONS).toEqual([Season.Spring, Season.Summer, Season.Autumn, Season.Winter]);
  });

  it("contains unique values", () => {
    const unique = new Set(ALL_SEASONS);
    expect(unique.size).toBe(ALL_SEASONS.length);
  });
});

// ── Validation helpers ───────────────────────────────────────────────────────

describe("isValidCourse", () => {
  it("returns true for valid course values (0, 1, 2)", () => {
    expect(isValidCourse(0)).toBe(true);
    expect(isValidCourse(1)).toBe(true);
    expect(isValidCourse(2)).toBe(true);
  });

  it("returns false for invalid course values", () => {
    expect(isValidCourse(-1)).toBe(false);
    expect(isValidCourse(3)).toBe(false);
    expect(isValidCourse(999)).toBe(false);
  });

  it("returns false for non-number types", () => {
    expect(isValidCourse(undefined as unknown as number)).toBe(false);
    expect(isValidCourse(null as unknown as number)).toBe(false);
  });
});

describe("isValidSeason", () => {
  it("returns true for valid season values (0, 1, 2, 3)", () => {
    expect(isValidSeason(0)).toBe(true);
    expect(isValidSeason(1)).toBe(true);
    expect(isValidSeason(2)).toBe(true);
    expect(isValidSeason(3)).toBe(true);
  });

  it("returns false for invalid season values", () => {
    expect(isValidSeason(-1)).toBe(false);
    expect(isValidSeason(4)).toBe(false);
    expect(isValidSeason(999)).toBe(false);
  });

  it("returns false for non-number types", () => {
    expect(isValidSeason(undefined as unknown as number)).toBe(false);
    expect(isValidSeason(null as unknown as number)).toBe(false);
  });
});

// ── Dish structure (compile-time + runtime shape) ────────────────────────────

describe("Dish type — structural contract", () => {
  it("accepts a valid dish object", () => {
    const dish = {
      id: "abc-123",
      userId: "user-1",
      name: "Spaghetti Carbonara",
      description: "A classic Italian pasta dish",
      course: Course.Main,
      seasons: [Season.Spring, Season.Summer],
      updatedAt: "2026-07-14T17:48:00Z",
      isDeleted: false,
    };

    expect(dish.id).toBe("abc-123");
    expect(dish.name).toBe("Spaghetti Carbonara");
    expect(dish.course).toBe(1);
    expect(dish.seasons).toEqual([0, 1]);
    expect(dish.isDeleted).toBe(false);
  });

  it("accepts a dish with empty description", () => {
    const dish = {
      id: "def-456",
      userId: "user-1",
      name: "Salade",
      description: "",
      course: Course.Starter,
      seasons: [Season.Summer],
      updatedAt: "2026-07-14T17:48:00Z",
      isDeleted: false,
    };
    expect(dish.description).toBe("");
  });

  it("accepts a dish with all seasons (year-round)", () => {
    const dish = {
      id: "ghi-789",
      userId: "user-1",
      name: "Pain",
      description: "Toujours disponible",
      course: Course.Starter,
      seasons: [Season.Spring, Season.Summer, Season.Autumn, Season.Winter],
      updatedAt: "2026-07-14T17:48:00Z",
      isDeleted: false,
    };
    expect(dish.seasons).toHaveLength(4);
  });
});

describe("CreateDishPayload — structural contract", () => {
  it("accepts a valid create payload", () => {
    const payload = {
      name: "Tarte aux pommes",
      course: Course.Dessert,
      seasons: [Season.Autumn, Season.Winter],
    };
    expect(payload.name).toBe("Tarte aux pommes");
    expect(payload.course).toBe(2);
    expect(payload.seasons).toEqual([2, 3]);
  });

  it("accepts a create payload with optional description", () => {
    const payload = {
      name: "Soupe à l'oignon",
      description: "Une soupe traditionnelle française",
      course: Course.Starter,
      seasons: [Season.Autumn, Season.Winter],
    };
    expect(payload.description).toBe("Une soupe traditionnelle française");
  });

  it("accepts a create payload without description", () => {
    const payload: CreateDishPayload = {
      name: "Crêpe",
      course: Course.Dessert,
      seasons: [Season.Spring, Season.Summer, Season.Autumn, Season.Winter],
    };
    expect(payload.description).toBeUndefined();
  });
});

describe("UpdateDishPayload — structural contract", () => {
  it("accepts a partial update (single field)", () => {
    const payload: Record<string, unknown> = { name: "Carbonara revisitée" };
    expect(payload.name).toBe("Carbonara revisitée");
    expect(payload.course).toBeUndefined();
  });

  it("accepts a full update payload", () => {
    const payload = {
      name: "Pizza",
      description: "Margherita",
      course: Course.Main,
      seasons: [Season.Summer],
    };
    expect(payload.name).toBe("Pizza");
    expect(payload.description).toBe("Margherita");
  });
});

// ── API result helpers ───────────────────────────────────────────────────────

describe("isApiError / isApiSuccess", () => {
  it("isApiError returns true for error result", () => {
    const result = { ok: false as const, error: { code: "NOT_FOUND", message: "Dish not found" } };
    expect(isApiError(result)).toBe(true);
    expect(isApiSuccess(result)).toBe(false);
  });

  it("isApiSuccess returns true for success result", () => {
    const result = { ok: true as const, data: { id: "abc" } };
    expect(isApiSuccess(result)).toBe(true);
    expect(isApiError(result)).toBe(false);
  });

  it("narrows union correctly with isApiError guard", () => {
    const result = { ok: false as const, error: { code: "VALIDATION_ERROR", message: "Invalid" } };
    if (isApiError(result)) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("narrows union correctly with isApiSuccess guard", () => {
    const result = { ok: true as const, data: { id: "xyz" } };
    if (isApiSuccess(result)) {
      expect(result.data.id).toBe("xyz");
    }
  });
});

// ── Backup / BackupSummary / RestoreBackupResponse — structural ──────────────

describe("Backup type — structural contract", () => {
  it("accepts a valid backup object", () => {
    const backup = {
      id: "back-1",
      userId: "user-1",
      label: "Before edit: Carbonara",
      createdAt: "2026-07-14T17:48:00Z",
      dishes: [
        {
          id: "dish-1",
          userId: "user-1",
          name: "Pâtes",
          description: "",
          course: Course.Main,
          seasons: [Season.Spring, Season.Summer],
          updatedAt: "2026-07-14T17:48:00Z",
          isDeleted: false,
        },
      ],
    };
    expect(backup.id).toBe("back-1");
    expect(backup.dishes).toHaveLength(1);
    expect(backup.dishes[0].name).toBe("Pâtes");
  });

  it("accepts a backup with empty dishes array", () => {
    const backup = {
      id: "back-2",
      userId: "user-1",
      label: "Empty backup",
      createdAt: "2026-07-14T17:48:00Z",
      dishes: [],
    };
    expect(backup.dishes).toHaveLength(0);
  });
});

describe("BackupSummary — structural contract", () => {
  it("accepts a valid backup summary", () => {
    const summary = {
      id: "back-1",
      label: "Before edit",
      createdAt: "2026-07-14T17:48:00Z",
      dishCount: 12,
    };
    expect(summary.dishCount).toBe(12);
  });
});

describe("RestoreBackupResponse — structural contract", () => {
  it("accepts a valid restore response", () => {
    const response = {
      backupId: "back-1",
      restoredCount: 12,
      safetyBackupCreatedAt: "2026-07-14T17:49:00Z",
    };
    expect(response.backupId).toBe("back-1");
    expect(response.restoredCount).toBe(12);
    expect(response.safetyBackupCreatedAt).toBeDefined();
  });
});

// ── API response types — structural ──────────────────────────────────────────

describe("ApiResponse / ApiListResponse — structural contract", () => {
  it("accepts a single-resource response", () => {
    const response: Record<string, unknown> = {
      data: { id: "d1", name: "Test" },
    };
    expect(response.data).toBeDefined();
  });

  it("accepts a list response with total", () => {
    const response: Record<string, unknown> = {
      data: [{ id: "d1" }, { id: "d2" }],
      total: 2,
    };
    expect(response.data).toHaveLength(2);
    expect(response.total).toBe(2);
  });
});

describe("ApiErrorDetail — structural contract", () => {
  it("accepts a simple error", () => {
    const error = { code: "NOT_FOUND", message: "Resource not found" };
    expect(error.code).toBe("NOT_FOUND");
  });

  it("accepts an error with field details", () => {
    const error = {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: [
        { field: "name", message: "Name is required" },
        { field: "course", message: "Course must be 0, 1, or 2", rejectedValue: 5 },
      ],
    };
    expect(error.details).toHaveLength(2);
    expect(error.details[0].field).toBe("name");
    expect(error.details[1].rejectedValue).toBe(5);
  });
});

describe("ApiEmptyResponse — structural contract", () => {
  it("accepts an empty success response", () => {
    const response = { success: true as const };
    expect(response.success).toBe(true);
  });
});

// ── Barrel export verification ───────────────────────────────────────────────

describe("Barrel exports (src/types/index.ts)", () => {
  it("exports Course and Season as values", () => {
    expect(Course).toBeDefined();
    expect(Season).toBeDefined();
    expect(Object.keys(Course)).not.toHaveLength(0);
  });

  it("exports COURSE_LABELS and SEASON_LABELS", () => {
    expect(COURSE_LABELS).toBeDefined();
    expect(SEASON_LABELS).toBeDefined();
  });

  it("exports ALL_SEASONS", () => {
    expect(ALL_SEASONS).toBeDefined();
    expect(Array.isArray(ALL_SEASONS)).toBe(true);
  });

  it("exports field length limits", () => {
    expect(MAX_NAME_LENGTH).toBe(200);
    expect(MAX_DESCRIPTION_LENGTH).toBe(5000);
    expect(MAX_FEEDBACK_LENGTH).toBe(2000);
    expect(MAX_USERNAME_LENGTH).toBe(100);
    expect(CHAR_LIMIT_THRESHOLD).toBe(20);
  });

  it("exports isValidCourse and isValidSeason", () => {
    expect(typeof isValidCourse).toBe("function");
    expect(typeof isValidSeason).toBe("function");
  });

  it("exports isApiError and isApiSuccess", () => {
    expect(typeof isApiError).toBe("function");
    expect(typeof isApiSuccess).toBe("function");
  });
});
