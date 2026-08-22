/**
 * Dish-related types for "Plat de la Semaine"
 */

import type { components } from "../schema";

export const Course = {
  Starter: 0,
  Main: 1,
  Dessert: 2,
} as const;
export type Course = (typeof Course)[keyof typeof Course];

export const Season = {
  Spring: 0,
  Summer: 1,
  Autumn: 2,
  Winter: 3,
} as const;
export type Season = (typeof Season)[keyof typeof Season];

export const COURSE_LABELS: Record<
  (typeof Course)[keyof typeof Course],
  string
> = {
  [Course.Starter]: "Entrée",
  [Course.Main]: "Plat",
  [Course.Dessert]: "Dessert",
};

export const SEASON_LABELS: Record<
  (typeof Season)[keyof typeof Season],
  string
> = {
  [Season.Spring]: "Printemps",
  [Season.Summer]: "Été",
  [Season.Autumn]: "Automne",
  [Season.Winter]: "Hiver",
};

export const ALL_SEASONS: Season[] = [
  Season.Spring,
  Season.Summer,
  Season.Autumn,
  Season.Winter,
];

export function getCurrentSeason(date: Date = new Date()): Season {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return Season.Spring;
  if (month >= 5 && month <= 7) return Season.Summer;
  if (month >= 8 && month <= 10) return Season.Autumn;
  return Season.Winter;
}

export const MAX_NAME_LENGTH = 200;

export const MAX_DESCRIPTION_LENGTH = 5000;

export const MAX_FEEDBACK_LENGTH = 2000;

export const MAX_USERNAME_LENGTH = 100;

export const CHAR_LIMIT_THRESHOLD = 20;

export type Dish = components["schemas"]["Dish"];
export type CreateDishPayload = components["schemas"]["CreateDishPayload"];
export type UpdateDishPayload = components["schemas"]["UpdateDishPayload"];

export type { DishDocType } from "../db/schemas/dishes";

export type SyncStatus =
  | "synced"
  | "pending_create"
  | "pending_update"
  | "pending_delete";

export function isValidCourse(value: number): value is Course {
  return Object.values(Course).includes(value as Course);
}

export function isValidSeason(value: number): value is Season {
  return Object.values(Season).includes(value as Season);
}
