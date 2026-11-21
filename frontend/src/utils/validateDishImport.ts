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
 * are reported in `errors` while valid items remain importable. This module
 * stays language-neutral: it reports message keys and parameters, and the UI
 * resolves them against the active locale.
 */

import type { MessageKey } from "../i18n";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  isValidCourse,
  isValidSeason,
} from "../types/dish";
import type {
  DishImportError,
  DishImportIssue,
  ValidatedDishImportItem,
} from "../types/dish";

export type ParseDishImportResult =
  | { ok: false; error: MessageKey }
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
  const errors: DishImportIssue[] = [];
  const rawName = isRecord(value) ? value.name : undefined;
  const name = typeof rawName === "string" ? rawName.trim() : null;

  if (!isRecord(value)) {
    errors.push({ field: "item", code: "notObject" });
    return { item: null, error: { index, name: null, errors } };
  }

  if (name === null || name === "") {
    errors.push({ field: "name", code: "nameRequired" });
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push({
      field: "name",
      code: "nameTooLong",
      params: { max: MAX_NAME_LENGTH },
    });
  }

  const rawDescription = value.description;
  let description = "";
  if (rawDescription === undefined || rawDescription === null) {
    description = "";
  } else if (typeof rawDescription !== "string") {
    errors.push({ field: "description", code: "descriptionType" });
  } else {
    description = rawDescription;
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        field: "description",
        code: "descriptionTooLong",
        params: { max: MAX_DESCRIPTION_LENGTH },
      });
    }
  }

  const rawCourse = value.course;
  if (typeof rawCourse !== "number" || !isValidCourse(rawCourse)) {
    errors.push({
      field: "course",
      code: "invalidCourse",
      rejectedValue: rawCourse,
    });
  }

  const rawSeasons = value.seasons;
  if (!Array.isArray(rawSeasons) || rawSeasons.length === 0) {
    errors.push({ field: "seasons", code: "seasonsRequired" });
  } else if (
    !rawSeasons.every((s) => typeof s === "number" && isValidSeason(s))
  ) {
    errors.push({
      field: "seasons",
      code: "invalidSeasons",
      rejectedValue: rawSeasons,
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
    return { ok: false, error: "import.invalidJson" };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "import.notArray" };
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
