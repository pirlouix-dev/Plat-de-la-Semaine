/**
 * Backup-related types for "Plat de la Semaine"
 *
 * A backup stores a complete snapshot of a user's dish list at a point in time.
 * The backend enforces a maximum of 5 backups per user, evicting the oldest.
 */

import type { Dish } from "./dish";

// ── Core Types ───────────────────────────────────────────────────────────────

/**
 * A backup entity as stored in the database and returned by the backend API.
 */
export interface Backup {
  /** Unique backup identifier */
  id: string;
  /** Owner user identifier */
  userId: string;
  /** Human-readable label or description of the backup */
  label: string;
  /** ISO-8601 timestamp when the backup was created */
  createdAt: string;
  /** Complete snapshot of dishes at the time of backup */
  dishes: Dish[];
}

/**
 * Lightweight backup metadata (returned by GET /api/backups).
 * Omits the full dish snapshot to reduce payload size on list queries.
 */
export interface BackupSummary {
  id: string;
  label: string;
  createdAt: string;
  dishCount: number;
}

/**
 * Response from POST /api/backups/restore/:backupId
 */
export interface RestoreBackupResponse {
  /** The backup ID that was restored */
  backupId: string;
  /** Number of dishes restored */
  restoredCount: number;
  /** ISO-8601 timestamp of the safety backup created before restore */
  safetyBackupCreatedAt: string;
}
