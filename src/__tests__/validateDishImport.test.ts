import { describe, it, expect } from "vitest";
import { parseDishImportJson } from "../utils/validateDishImport";
import { Course, Season, MAX_NAME_LENGTH } from "../types/dish";

describe("parseDishImportJson", () => {
  it("rejects malformed JSON", () => {
    const result = parseDishImportJson("{ not json");
    expect(result).toEqual({
      ok: false,
      error: "Le fichier n'est pas un JSON valide.",
    });
  });

  it("rejects a non-array top level", () => {
    const result = parseDishImportJson(JSON.stringify({ name: "X" }));
    expect(result).toEqual({
      ok: false,
      error: "Le JSON doit contenir un tableau de plats.",
    });
  });

  it("parses valid dishes", () => {
    const result = parseDishImportJson(
      JSON.stringify([
        {
          name: "Ratatouille",
          description: "Légumes mijotés",
          course: Course.Main,
          seasons: [Season.Summer, Season.Autumn],
        },
        {
          name: "Tarte aux pommes",
          course: Course.Dessert,
          seasons: [Season.Autumn],
        },
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      {
        name: "Ratatouille",
        description: "Légumes mijotés",
        course: Course.Main,
        seasons: [Season.Summer, Season.Autumn],
      },
      {
        name: "Tarte aux pommes",
        description: "",
        course: Course.Dessert,
        seasons: [Season.Autumn],
      },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("trims the dish name", () => {
    const result = parseDishImportJson(
      JSON.stringify([{ name: "  Quiche  ", course: 1, seasons: [0] }]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items[0].name).toBe("Quiche");
  });

  it("reports per-item errors while keeping valid items", () => {
    const result = parseDishImportJson(
      JSON.stringify([
        { name: "", course: 1, seasons: [0] },
        { name: "Ok", course: 1, seasons: [0] },
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].index).toBe(0);
    expect(result.errors[0].errors).toContainEqual({
      field: "name",
      message: "Le nom est requis",
    });
  });

  it("rejects a non-numeric course (labels not accepted)", () => {
    const result = parseDishImportJson(
      JSON.stringify([{ name: "Ok", course: "Plat", seasons: [0] }]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(0);
    expect(result.errors[0].errors[0].field).toBe("course");
  });

  it("rejects out-of-range course and seasons", () => {
    const result = parseDishImportJson(
      JSON.stringify([{ name: "Ok", course: 9, seasons: [0, 7] }]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(0);
    const fields = result.errors[0].errors.map((e) => e.field);
    expect(fields).toContain("course");
    expect(fields).toContain("seasons");
  });

  it("requires at least one season", () => {
    const result = parseDishImportJson(
      JSON.stringify([{ name: "Ok", course: 1, seasons: [] }]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(0);
    expect(result.errors[0].errors[0].field).toBe("seasons");
  });

  it("rejects a name longer than the allowed length", () => {
    const result = parseDishImportJson(
      JSON.stringify([
        { name: "a".repeat(MAX_NAME_LENGTH + 1), course: 1, seasons: [0] },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(0);
    expect(result.errors[0].errors[0].field).toBe("name");
  });

  it("reports a non-object item", () => {
    const result = parseDishImportJson(JSON.stringify(["nope"]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(0);
    expect(result.errors[0].errors[0].field).toBe("item");
  });
});
