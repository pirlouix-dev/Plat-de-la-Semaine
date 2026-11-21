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
  DishBatchOperation,
  DishBatchOperationResult,
  DishBatchPayload,
  DishBatchResponse,
  DishBatchStatus,
  DishImportError,
  DishImportIssue,
  ImportIssueCode,
  ValidatedDishImportItem,
  DishDocType,
  SyncStatus,
} from "./dish";
export {
  Course,
  Season,
  COURSE_LABEL_KEYS,
  COURSE_PLURAL_LABEL_KEYS,
  SEASON_LABEL_KEYS,
  ALL_SEASONS,
  getCurrentSeason,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_FEEDBACK_LENGTH,
  MAX_USERNAME_LENGTH,
  CHAR_LIMIT_THRESHOLD,
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
