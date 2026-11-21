import { useEffect } from "react";
import { pingServer } from "../services/settingsService";

/**
 * Ping the backend on mount to warm it up.
 * Fire-and-forget: failures are ignored since the result is not actionable.
 */
export function useWarmupPing(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    void pingServer();
  }, [enabled]);
}
