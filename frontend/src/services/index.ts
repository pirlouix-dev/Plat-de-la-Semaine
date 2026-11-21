/**
 * Barrel export for all API services.
 *
 * Usage:
 *   import { getDishes, createDish } from "../services";
 *   import type { VersionInfo, FeedbackPayload } from "../services";
 */

// ── API client (raw request builders) ────────────────────────────────────────
export { apiGet, apiPost, apiPut, apiDelete, setBaseUrl } from "./api";
export type { ApiResult } from "./api";

// ── Dish service ─────────────────────────────────────────────────────────────
export {
  getDishes,
  createDish,
  updateDish,
  deleteDish,
  applyDishBatch,
  DISH_BATCH_MAX_OPERATIONS,
} from "./dishService";

// ── Backup service ───────────────────────────────────────────────────────────
export {
  getBackups,
  restoreBackup,
} from "./backupService";

// ── Settings service ─────────────────────────────────────────────────────────
export {
  getVersionInfo,
  submitFeedback,
  pingServer,
} from "./settingsService";
export type { VersionInfo, FeedbackPayload } from "./settingsService";
