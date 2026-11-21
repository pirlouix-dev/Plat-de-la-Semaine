import { useCallback } from "react";
import { useToast } from "../components/toastContext";
import {
  getApiErrorMessage,
  getApiErrorToastDuration,
} from "../services/api";
import type { ApiErrorDetail } from "../types";

/**
 * Returns a callback that shows an API error as a localised toast. The duration
 * is only passed when the error needs a custom one, so callers keep the default
 * toast behaviour otherwise.
 */
export function useApiErrorToast(): (error: ApiErrorDetail) => void {
  const { showToast } = useToast();

  return useCallback(
    (error: ApiErrorDetail) => {
      const duration = getApiErrorToastDuration(error);
      if (duration === undefined) {
        showToast(getApiErrorMessage(error), "error");
      } else {
        showToast(getApiErrorMessage(error), "error", duration);
      }
    },
    [showToast],
  );
}
