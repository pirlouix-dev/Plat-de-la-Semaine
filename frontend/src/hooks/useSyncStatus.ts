import { useSyncExternalStore } from "react";
import { useTranslation, type Translate } from "../i18n";
import {
  getSyncState,
  subscribeSyncState,
  type SyncState,
} from "../services/syncStatusStore";

export interface SyncDisplay {
  text: string;
  isError: boolean;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatAge(ageMs: number, t: Translate): string {
  if (ageMs < MINUTE_MS) return t("sync.age.now");
  const minutes = Math.floor(ageMs / MINUTE_MS);
  if (minutes < 60) return t("sync.age.minutes", { count: minutes });
  const hours = Math.floor(ageMs / HOUR_MS);
  if (hours < 24) return t("sync.age.hours", { count: hours });
  return t("sync.age.days", { count: Math.floor(ageMs / DAY_MS) });
}

/** Pure mapping from sync state to subtitle content. Exported for tests. */
export function deriveSyncDisplay(
  state: SyncState,
  now: number,
  t: Translate,
): SyncDisplay {
  if (!state.online) {
    return { text: t("sync.offline"), isError: true };
  }

  if (state.phase === "syncing") {
    return { text: t("sync.syncing"), isError: false };
  }

  const hasError =
    state.lastErrorAt !== null &&
    (state.lastSyncAt === null ||
      new Date(state.lastErrorAt).getTime() >
        new Date(state.lastSyncAt).getTime());

  if (hasError) {
    if (state.retryCount > 0) {
      return {
        text: t("sync.failedRetry", { count: state.retryCount }),
        isError: true,
      };
    }
    return { text: t("sync.failed"), isError: true };
  }

  if (state.lastSyncAt !== null) {
    const age = Math.max(0, now - new Date(state.lastSyncAt).getTime());
    return {
      text: t("sync.synced", { age: formatAge(age, t) }),
      isError: false,
    };
  }

  return { text: t("sync.waiting"), isError: false };
}

function subscribeToClock(onChange: () => void): () => void {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
}

function getClockTick(): number {
  return Math.floor(Date.now() / 1000);
}

export function useSyncStatus(): SyncDisplay {
  const state = useSyncExternalStore(subscribeSyncState, getSyncState);
  const tick = useSyncExternalStore(subscribeToClock, getClockTick);
  const { t } = useTranslation();

  return deriveSyncDisplay(state, tick * 1000, t);
}

/** Reactive raw sync state, for callers that need more than the display text. */
export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSyncState, getSyncState);
}
