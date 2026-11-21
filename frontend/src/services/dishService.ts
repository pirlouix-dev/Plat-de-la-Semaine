/**
 * Dish API service
 *
 * CRUD operations for dishes via the .NET backend.
 */

import type { components } from "../schema";
import { apiGet, apiPost, apiPut, apiDelete } from "./api";
import type { ApiResult } from "./api";

type Dish = components["schemas"]["Dish"];
type DishListResponse = components["schemas"]["DishListResponse"];
type DishSingleResponse = components["schemas"]["DishSingleResponse"];
type CreateDishPayload = components["schemas"]["CreateDishPayload"];
type UpdateDishPayload = components["schemas"]["UpdateDishPayload"];
type DishBatchPayload = components["schemas"]["DishBatchPayload"];
type DishBatchResponse = components["schemas"]["DishBatchResponse"];

/**
 * Backend cap on the number of operations in one batch
 * (`DishService.MaxBatchSize`).
 */
export const DISH_BATCH_MAX_OPERATIONS = 500;

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Fetch all dishes for the current user.
 * When `since` is provided, only dishes modified after that timestamp are returned.
 * The backend returns dishes sorted alphabetically by name.
 */
export async function getDishes(
  options?: { signal?: AbortSignal; since?: string }
): Promise<ApiResult<Dish[]>> {
  const params = options?.since ? { since: options.since } : undefined;
  const result = await apiGet<DishListResponse>("/api/dishes", {
    signal: options?.signal,
    params,
  });
  if (result.ok) {
    return { ok: true, data: result.data.data };
  }
  return result;
}

/**
 * Create a new dish.
 * The backend assigns `id`, `userId`, `updatedAt`, and `isDeleted`.
 */
export async function createDish(
  payload: CreateDishPayload,
  options?: { signal?: AbortSignal }
): Promise<ApiResult<Dish>> {
  const result = await apiPost<DishSingleResponse>(
    "/api/dishes",
    payload,
    options
  );
  if (result.ok) {
    return { ok: true, data: result.data.data };
  }
  return result;
}

/**
 * Update an existing dish.
 */
export async function updateDish(
  id: string,
  payload: UpdateDishPayload,
  options?: { signal?: AbortSignal }
): Promise<ApiResult<Dish>> {
  const result = await apiPut<DishSingleResponse>(
    `/api/dishes/${encodeURIComponent(id)}`,
    payload,
    options
  );
  if (result.ok) {
    return { ok: true, data: result.data.data };
  }
  return result;
}

/**
 * Apply a batch of dish create, update, and delete operations.
 *
 * The backend applies the operations in order and reports each outcome
 * separately, so a partial failure does not roll back the operations that
 * succeeded. At most `DISH_BATCH_MAX_OPERATIONS` operations fit in one call.
 */
export async function applyDishBatch(
  payload: DishBatchPayload,
  options?: { signal?: AbortSignal }
): Promise<ApiResult<DishBatchResponse>> {
  return apiPost<DishBatchResponse>("/api/dishes/batch", payload, options);
}

/**
 * Soft-delete a dish.
 * Returns `void` on success (HTTP 204).
 */
export async function deleteDish(
  id: string,
  options?: { signal?: AbortSignal }
): Promise<ApiResult<void>> {
  return apiDelete<void>(
    `/api/dishes/${encodeURIComponent(id)}`,
    options
  );
}


