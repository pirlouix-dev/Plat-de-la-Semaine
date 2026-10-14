import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildDishExport,
  serializeDishExport,
  buildExportFilename,
  downloadJsonFile,
} from "../utils/dishExport";
import { parseDishImportJson } from "../utils/validateDishImport";
import { Course, Season } from "../types/dish";
import type { DishDocType } from "../db/schemas/dishes";

function makeDish(overrides: Partial<DishDocType> = {}): DishDocType {
  return {
    id: crypto.randomUUID(),
    serverId: "server-1",
    name: "Ratatouille",
    description: "Légumes mijotés",
    course: Course.Main,
    seasons: [Season.Summer, Season.Autumn],
    updatedAt: "2026-01-01T00:00:00.000Z",
    isDeleted: false,
    syncStatus: "synced",
    ...overrides,
  };
}

describe("buildDishExport", () => {
  it("maps dishes to the import shape with numeric enums", () => {
    const result = buildDishExport([makeDish()]);

    expect(result).toEqual([
      {
        name: "Ratatouille",
        description: "Légumes mijotés",
        course: 1,
        seasons: [1, 2],
      },
    ]);
  });

  it("drops sync bookkeeping fields", () => {
    const [item] = buildDishExport([makeDish()]);
    expect(item).not.toHaveProperty("id");
    expect(item).not.toHaveProperty("syncStatus");
    expect(item).not.toHaveProperty("isDeleted");
  });

  it("excludes soft-deleted dishes", () => {
    const result = buildDishExport([
      makeDish({ name: "Kept" }),
      makeDish({ name: "Deleted", isDeleted: true }),
    ]);

    expect(result.map((item) => item.name)).toEqual(["Kept"]);
  });

  it("sorts dishes by name", () => {
    const result = buildDishExport([
      makeDish({ name: "Tarte" }),
      makeDish({ name: "Avocat" }),
      makeDish({ name: "Quiche" }),
    ]);

    expect(result.map((item) => item.name)).toEqual([
      "Avocat",
      "Quiche",
      "Tarte",
    ]);
  });

  it("returns an empty array when there are no dishes", () => {
    expect(buildDishExport([])).toEqual([]);
  });
});

describe("serializeDishExport", () => {
  it("round-trips through parseDishImportJson", () => {
    const dishes = [
      makeDish({ name: "Ratatouille" }),
      makeDish({
        name: "Tarte aux pommes",
        description: "",
        course: Course.Dessert,
        seasons: [Season.Autumn],
      }),
    ];

    const parsed = parseDishImportJson(serializeDishExport(dishes));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.errors).toEqual([]);
    expect(parsed.items).toEqual(buildDishExport(dishes));
  });

  it("produces a JSON array", () => {
    expect(JSON.parse(serializeDishExport([]))).toEqual([]);
  });
});

describe("buildExportFilename", () => {
  it("stamps the date as day-month-year", () => {
    expect(buildExportFilename(new Date(2026, 9, 14))).toBe(
      "plats-14-10-2026.json",
    );
  });

  it("zero-pads single-digit months and days", () => {
    expect(buildExportFilename(new Date(2026, 0, 5))).toBe(
      "plats-05-01-2026.json",
    );
  });
});

describe("downloadJsonFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads the JSON as an application/json file", () => {
    let blob: Blob | undefined;
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((value: Blob | MediaSource) => {
        blob = value as Blob;
        return "blob:mock";
      });
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadJsonFile("plats-14-10-2026.json", '[{"name":"X"}]');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(blob?.type).toBe("application/json");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
