/**
 * Backup API service
 *
 * Fetch and restore backup snapshots of the dish list.
 */

import type { BackupSummary, RestoreBackupResponse } from "../types";
import { apiGet, apiPost } from "./api";
import type { ApiResult } from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

/** Response shape for GET /api/backups */
interface BackupListResponse {
  data: BackupSummary[];
  total: number;
}

/** Response shape for POST /api/backups/restore/:id */
interface BackupRestoreResponse {
  data: RestoreBackupResponse;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Fetch all backups for the current user (max 5, newest first).
 */
export async function getBackups(
  options?: { signal?: AbortSignal }
): Promise<ApiResult<BackupSummary[]>> {
  const result = await apiGet<BackupListResponse>("/api/backups", options);
  if (result.ok) {
    return { ok: true, data: result.data.data };
  }
  return result;
}

/**
 * Restore the dish list from a specific backup.
 * The backend creates a safety backup of the current state before restoring.
 */
export async function restoreBackup(
  backupId: string,
  options?: { signal?: AbortSignal }
): Promise<ApiResult<RestoreBackupResponse>> {
  const result = await apiPost<BackupRestoreResponse>(
    `/api/backups/restore/${encodeURIComponent(backupId)}`,
    undefined,
    options
  );
  if (result.ok) {
    return { ok: true, data: result.data.data };
  }
  return result;
}
