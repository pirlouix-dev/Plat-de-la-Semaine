/**
 * Settings API service
 *
 * Version check, feedback submission, and utility endpoints.
 */

import type { components } from "../schema";
import { apiGet, apiPost } from "./api";
import type { ApiResult } from "./api";

export type VersionInfo = components["schemas"]["VersionInfo"];
export type FeedbackPayload = components["schemas"]["FeedbackPayload"];

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

/**
 * Ping the backend to warm it up.
 * Returns void on success (HTTP 200).
 */
export async function pingServer(
  options?: { signal?: AbortSignal }
): Promise<ApiResult<void>> {
  return apiGet<void>("/api/ping", options);
}
