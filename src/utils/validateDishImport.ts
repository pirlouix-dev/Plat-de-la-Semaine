/**
 * Client-side validation for dish JSON imports.
 *
 * The accepted format is a JSON array of objects:
 *
 *   [
 *     { "name": "Ratatouille", "description": "…", "course": 1, "seasons": [1, 2] }
 *   ]
 *
 * Course and seasons must be numeric enum values (0-2 and 0-3). Malformed JSON
 * or a non-array top level rejects the whole payload; individual invalid items
 * are reported in `errors` while valid items remain importable.
 */

import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  isValidCourse,
  isValidSeason,
} from "../types/dish";
import type {
  DishImportError,
  ValidatedDishImportItem,
} from "../types/dish";
import type { ApiFieldError } from "../types/api";

export type ParseDishImportResult =
  | { ok: false; error: string }
  | {
      ok: true;
      total: number;
      items: ValidatedDishImportItem[];
      errors: DishImportError[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateItem(
  value: unknown,
  index: number,
): { item: ValidatedDishImportItem | null; error: DishImportError | null } {
  const errors: ApiFieldError[] = [];
  const rawName = isRecord(value) ? value.name : undefined;
  const name = typeof rawName === "string" ? rawName.trim() : null;

  if (!isRecord(value)) {
    errors.push({ field: "item", message: "L'élément doit être un objet" });
    return { item: null, error: { index, name: null, errors } };
  }

  if (name === null || name === "") {
    errors.push({ field: "name", message: "Le nom est requis" });
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push({
      field: "name",
      message: `Le nom ne doit pas dépasser ${MAX_NAME_LENGTH} caractères`,
    });
  }

  const rawDescription = value.description;
  let description = "";
  if (rawDescription === undefined || rawDescription === null) {
    description = "";
  } else if (typeof rawDescription !== "string") {
    errors.push({
      field: "description",
      message: "La description doit être une chaîne de caractères",
    });
  } else {
    description = rawDescription;
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        field: "description",
        message: `La description ne doit pas dépasser ${MAX_DESCRIPTION_LENGTH} caractères`,
      });
    }
  }

  const rawCourse = value.course;
  if (typeof rawCourse !== "number" || !isValidCourse(rawCourse)) {
    errors.push({
      field: "course",
      message: "Le type de plat doit être 0 (entrée), 1 (plat) ou 2 (dessert)",
    });
  }

  const rawSeasons = value.seasons;
  if (!Array.isArray(rawSeasons) || rawSeasons.length === 0) {
    errors.push({
      field: "seasons",
      message: "Au moins une saison est requise",
    });
  } else if (!rawSeasons.every((s) => typeof s === "number" && isValidSeason(s))) {
    errors.push({
      field: "seasons",
      message: "Les saisons doivent être comprises entre 0 et 3",
    });
  }

  if (errors.length > 0) {
    return { item: null, error: { index, name, errors } };
  }

  return {
    item: {
      name: name as string,
      description,
      course: rawCourse as ValidatedDishImportItem["course"],
      seasons: rawSeasons as ValidatedDishImportItem["seasons"],
    },
    error: null,
  };
}

export function parseDishImportJson(raw: string): ParseDishImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Le fichier n'est pas un JSON valide." };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: "Le JSON doit contenir un tableau de plats.",
    };
  }

  const items: ValidatedDishImportItem[] = [];
  const errors: DishImportError[] = [];

  parsed.forEach((entry, index) => {
    const { item, error } = validateItem(entry, index);
    if (item) items.push(item);
    if (error) errors.push(error);
  });

  return { ok: true, total: parsed.length, items, errors };
}
