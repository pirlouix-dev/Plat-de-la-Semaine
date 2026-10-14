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

export type SaveJsonResult = "saved" | "cancelled";

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}

function getSaveFilePicker():
  | ((options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>)
  | undefined {
  return (
    window as unknown as {
      showSaveFilePicker?: (
        options?: SaveFilePickerOptions,
      ) => Promise<FileSystemFileHandle>;
    }
  ).showSaveFilePicker;
}

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
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `plats-${day}-${month}-${date.getFullYear()}.json`;
}

/**
 * Ask the user where to save the file when the File System Access API is
 * available, and fall back to a plain download otherwise.
 */
export async function saveJsonFile(
  filename: string,
  json: string,
): Promise<SaveJsonResult> {
  const blob = new Blob([json], { type: "application/json" });
  const showSaveFilePicker = getSaveFilePicker();

  if (showSaveFilePicker) {
    try {
      const handle = await showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "Fichier JSON",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      throw error;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return "saved";
}
