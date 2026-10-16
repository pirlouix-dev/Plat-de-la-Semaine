/**
 * Menu API service
 *
 * Reads and writes the saved weekly menu for the authenticated user.
 */

import type { components } from "../schema";
import { apiGet, apiPut } from "./api";
import type { ApiResult } from "./api";

type Menu = components["schemas"]["Menu"];
type MenuResponse = components["schemas"]["MenuResponse"];
type SaveMenuPayload = components["schemas"]["SaveMenuPayload"];

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's saved menu.
 * Returns an empty menu (with a null `updatedAt`) when none has been saved.
 */
export async function getMenu(options?: {
  signal?: AbortSignal;
}): Promise<ApiResult<Menu>> {
  const result = await apiGet<MenuResponse>("/api/menu", options);
  if (result.ok) {
    return { ok: true, data: result.data.data };
  }
  return result;
}

/**
 * Upsert the current user's saved menu.
 */
export async function saveMenu(
  payload: SaveMenuPayload,
  options?: { signal?: AbortSignal },
): Promise<ApiResult<Menu>> {
  const result = await apiPut<MenuResponse>("/api/menu", payload, options);
  if (result.ok) {
    return { ok: true, data: result.data.data };
  }
  return result;
}
