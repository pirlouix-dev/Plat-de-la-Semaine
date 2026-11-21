import { apiPut, apiPost, apiDelete } from "./api";
import type { ApiResult } from "./api";

export async function updateUsername(
  username: string,
  options?: { signal?: AbortSignal },
): Promise<ApiResult<void>> {
  return apiPut<void>("/api/auth/username", { username }, options);
}

export async function resetPassword(
  options?: { signal?: AbortSignal },
): Promise<ApiResult<void>> {
  return apiPost<void>("/api/auth/reset-password", undefined, options);
}

export async function deleteAccount(
  options?: { signal?: AbortSignal },
): Promise<ApiResult<{ message?: string }>> {
  return apiDelete<{ message?: string }>("/api/auth/account", options);
}
