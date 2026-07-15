/**
 * Settings API service
 *
 * Version check, feedback submission, and utility endpoints.
 */

import { apiGet, apiPost } from "./api";
import type { ApiResult } from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

/** Version info returned by GET /api/version */
export interface VersionInfo {
  /** Semantic version string (e.g., "2.0.0") */
  latestVersion: string;
  /** Human-readable update description */
  description: string;
  /** Download URL for the latest version */
  downloadUrl: string;
}

/** Feedback submission payload */
export interface FeedbackPayload {
  /** The feedback / bug report message */
  message: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Fetch the latest version information from the backend.
 */
export async function getVersionInfo(
  options?: { signal?: AbortSignal }
): Promise<ApiResult<VersionInfo>> {
  return apiGet<VersionInfo>("/api/version", options);
}

/**
 * Submit a bug report or feedback message.
 * Returns void on success (HTTP 200).
 */
export async function submitFeedback(
  payload: FeedbackPayload,
  options?: { signal?: AbortSignal }
): Promise<ApiResult<void>> {
  return apiPost<void>("/api/feedback", payload, options);
}
