/**
 * Client-side export of dishes to the same JSON format the import accepts.
 *
 * Output is an array of objects with numeric enums:
 *
 *   [
 *     { "name": "Ratatouille", "description": "…", "course": 1, "seasons": [1, 2] }
 *   ]
 *
 * The shape matches `ValidatedDishImportItem`, so an exported file round-trips
 * through `parseDishImportJson`.
 */

import type { DishDocType, ValidatedDishImportItem } from "../types/dish";

export function buildDishExport(
  dishes: DishDocType[],
): ValidatedDishImportItem[] {
  return dishes
    .filter((dish) => !dish.isDeleted)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((dish) => ({
      name: dish.name,
      description: dish.description,
      course: dish.course as ValidatedDishImportItem["course"],
      seasons: dish.seasons as ValidatedDishImportItem["seasons"],
    }));
}

export function serializeDishExport(dishes: DishDocType[]): string {
  return JSON.stringify(buildDishExport(dishes), null, 2);
}

export function buildExportFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `plats-${year}-${month}-${day}.json`;
}

export function downloadJsonFile(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
