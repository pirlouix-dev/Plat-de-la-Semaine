/**
 * Dish API service
 *
 * CRUD operations for dishes via the .NET backend.
 */

import type { Dish, CreateDishPayload, UpdateDishPayload } from "../types";
import { apiGet, apiPost, apiPut, apiDelete } from "./api";
import type { ApiResult } from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

/** Response shape for GET /api/dishes */
interface DishListResponse {
  data: Dish[];
  total: number;
}

/** Response shape for POST/PUT /api/dishes */
interface DishSingleResponse {
  data: Dish;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Fetch all dishes for the current user.
 * The backend returns dishes sorted alphabetically by name.
 */
export async function getDishes(
  options?: { signal?: AbortSignal }
): Promise<ApiResult<Dish[]>> {
  const result = await apiGet<DishListResponse>("/api/dishes", options);
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

/**
 * Re-sort all dishes alphabetically (POST /api/dishes/sort).
 */
export async function sortDishes(
  options?: { signal?: AbortSignal }
): Promise<ApiResult<Dish[]>> {
  const result = await apiPost<DishListResponse>(
    "/api/dishes/sort",
    undefined,
    options
  );
  if (result.ok) {
    return { ok: true, data: result.data.data };
  }
  return result;
}
