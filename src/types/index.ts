/**
 * Barrel export for all application types.
 *
 * Import from here instead of individual type files:
 *   import { Dish, Course, Backup, ApiResponse } from "./types";
 */

export type {
  Dish,
  CreateDishPayload,
  UpdateDishPayload,
} from "./dish";
export {
  Course,
  Season,
  COURSE_LABELS,
  SEASON_LABELS,
  ALL_SEASONS,
  isValidCourse,
  isValidSeason,
} from "./dish";

export type {
  Backup,
  BackupSummary,
  RestoreBackupResponse,
} from "./backup";

export type {
  ApiResponse,
  ApiListResponse,
  ApiEmptyResponse,
  ApiErrorDetail,
  ApiFieldError,
  ApiResult,
} from "./api";
export {
  isApiError,
  isApiSuccess,
} from "./api";
