import { useSyncExternalStore } from "react";
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

export function formatAge(ageMs: number): string {
  if (ageMs < MINUTE_MS) return "à l'instant";
  const minutes = Math.floor(ageMs / MINUTE_MS);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(ageMs / HOUR_MS);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(ageMs / DAY_MS)} j`;
}

/** Pure mapping from sync state to subtitle content. Exported for tests. */
export function deriveSyncDisplay(state: SyncState, now: number): SyncDisplay {
  if (!state.online) {
    return {
      text: "Hors ligne — synchronisation dès le retour de la connexion",
      isError: true,
    };
  }

  if (state.phase === "syncing") {
    return { text: "Synchronisation en cours…", isError: false };
  }

  const hasError =
    state.lastErrorAt !== null &&
    (state.lastSyncAt === null ||
      new Date(state.lastErrorAt).getTime() >
        new Date(state.lastSyncAt).getTime());

  if (hasError) {
    if (
      state.nextRetryAt !== null &&
      state.nextRetryAt > now
    ) {
      const seconds = Math.ceil((state.nextRetryAt - now) / 1000);
      const retryIn =
        seconds >= 60
          ? `dans ${Math.floor(seconds / 60)} min`
          : `dans ${seconds}s`;
      return {
        text: `Échec de la synchronisation · nouvelle tentative ${retryIn}`,
        isError: true,
      };
    }
    return {
      text: "Échec de la synchronisation",
      isError: true,
    };
  }

  if (state.lastSyncAt !== null) {
    const age = Math.max(0, now - new Date(state.lastSyncAt).getTime());
    return {
      text: `Vos plats sont synchronisés · ${formatAge(age)}`,
      isError: false,
    };
  }

  return { text: "Synchronisation en attente…", isError: false };
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

  return deriveSyncDisplay(state, tick * 1000);
}
