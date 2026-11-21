/**
 * Dish-related types for "Plat de la Semaine"
 */

import type { components } from "../schema";
import type { InterpolationParams, MessageKey } from "../i18n/types";

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

export const COURSE_LABEL_KEYS: Record<Course, MessageKey> = {
  [Course.Starter]: "course.starter",
  [Course.Main]: "course.main",
  [Course.Dessert]: "course.dessert",
};

export const COURSE_PLURAL_LABEL_KEYS: Record<Course, MessageKey> = {
  [Course.Starter]: "course.starter.plural",
  [Course.Main]: "course.main.plural",
  [Course.Dessert]: "course.dessert.plural",
};

export const SEASON_LABEL_KEYS: Record<Season, MessageKey> = {
  [Season.Spring]: "season.spring",
  [Season.Summer]: "season.summer",
  [Season.Autumn]: "season.autumn",
  [Season.Winter]: "season.winter",
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

export type DishBatchOperation = components["schemas"]["DishBatchOperation"];
export type DishBatchOperationResult =
  components["schemas"]["DishBatchOperationResult"];
export type DishBatchPayload = components["schemas"]["DishBatchPayload"];
export type DishBatchResponse = components["schemas"]["DishBatchResponse"];

/** Outcome the batch endpoint reports for one operation. */
export type DishBatchStatus = "created" | "updated" | "deleted" | "failed";

/** Why one import entry was rejected, kept language-neutral for the UI layer. */
export type ImportIssueCode =
  | "notObject"
  | "nameRequired"
  | "nameTooLong"
  | "descriptionType"
  | "descriptionTooLong"
  | "invalidCourse"
  | "seasonsRequired"
  | "invalidSeasons";

export interface DishImportIssue {
  field: string;
  code: ImportIssueCode;
  params?: InterpolationParams;
  rejectedValue?: unknown;
}

/**
 * Client-side report for one rejected import entry. Importing is a local-first
 * operation now, so this is no longer derived from the API schema.
 */
export interface DishImportError {
  index: number;
  name: string | null;
  errors: DishImportIssue[];
}

/**
 * A dish import entry that passed client-side validation: every field is
 * guaranteed present, unlike the nullable batch operation payload.
 */
export interface ValidatedDishImportItem {
  name: string;
  description: string;
  course: Course;
  seasons: Season[];
}

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
