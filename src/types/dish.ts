/**
 * Dish-related types for "Plat de la Semaine"
 *
 * Matches the data model from the original Python application and aligns
 * with the .NET backend API contract.
 */

import type { components } from "../schema";

// ── Enums (const-object pattern for erasableSyntaxOnly compat) ────────────────

/** Course (type) of a dish: 0 = Starter, 1 = Main, 2 = Dessert */
export const Course = {
  Starter: 0,
  Main: 1,
  Dessert: 2,
} as const;
export type Course = (typeof Course)[keyof typeof Course];

/** Season tag: 0 = Spring, 1 = Summer, 2 = Autumn, 3 = Winter */
export const Season = {
  Spring: 0,
  Summer: 1,
  Autumn: 2,
  Winter: 3,
} as const;
export type Season = (typeof Season)[keyof typeof Season];

// ── Constants ────────────────────────────────────────────────────────────────

/** French labels for course types, indexed by Course value */
export const COURSE_LABELS: Record<(typeof Course)[keyof typeof Course], string> = {
  [Course.Starter]: "Entrée",
  [Course.Main]: "Plat",
  [Course.Dessert]: "Dessert",
};

/** French labels for seasons, indexed by Season value */
export const SEASON_LABELS: Record<(typeof Season)[keyof typeof Season], string> = {
  [Season.Spring]: "Printemps",
  [Season.Summer]: "Été",
  [Season.Autumn]: "Automne",
  [Season.Winter]: "Hiver",
};

/** Convenience list of all season values */
export const ALL_SEASONS: Season[] = [
  Season.Spring,
  Season.Summer,
  Season.Autumn,
  Season.Winter,
];

// ── Field length limits (mirror backend StringLength attributes) ─────────────

/** Max length of a dish name (backend: 200) */
export const MAX_NAME_LENGTH = 200;

/** Max length of a dish description (backend: 5000) */
export const MAX_DESCRIPTION_LENGTH = 5000;

/** Max length of a feedback message (backend: 2000) */
export const MAX_FEEDBACK_LENGTH = 2000;

/** Max length of a user username (backend: 100) */
export const MAX_USERNAME_LENGTH = 100;

/** Remaining-characters threshold at which the limit counter appears */
export const CHAR_LIMIT_THRESHOLD = 20;

// ── Core Types (from OpenAPI schema) ─────────────────────────────────────────

export type Dish = components["schemas"]["Dish"];
export type CreateDishPayload = components["schemas"]["CreateDishPayload"];
export type UpdateDishPayload = components["schemas"]["UpdateDishPayload"];

// ── RxDB Document Types ─────────────────────────────────────────────────────

export type { DishDocType } from "../db/schemas/dishes";

export type SyncStatus =
  | "synced"
  | "pending_create"
  | "pending_update"
  | "pending_delete";

// ── Validation helpers ───────────────────────────────────────────────────────

/** Check whether a numeric value is a valid Course member */
export function isValidCourse(value: number): value is Course {
  return Object.values(Course).includes(value as Course);
}

/** Check whether a numeric value is a valid Season member */
export function isValidSeason(value: number): value is Season {
  return Object.values(Season).includes(value as Season);
}
