/**
 * Backup-related types for "Plat de la Semaine"
 *
 * A backup stores a complete snapshot of a user's dish list at a point in time.
 * The backend enforces a maximum of 5 backups per user, evicting the oldest.
 */

import type { components } from "../schema";
import type { Dish } from "./dish";

// ── Core Types (from OpenAPI schema) ─────────────────────────────────────────

export type BackupSummary = components["schemas"]["BackupSummary"];
export type RestoreBackupResponse = components["schemas"]["RestoreBackupResponse"];

/**
 * A backup entity with full dish snapshot.
 * Combines BackupSummary metadata with the complete dish list.
 */
export interface Backup {
  id: string;
  userId: string;
  label: string;
  createdAt: string;
  dishes: Dish[];
}
