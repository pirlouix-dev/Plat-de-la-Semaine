export type SyncPhase = "idle" | "syncing";

export interface SyncState {
  /** Whether a sync cycle is currently running (network + merge). */
  phase: SyncPhase;
  /** Browser connectivity (navigator.onLine). */
  online: boolean;
  /** ISO timestamp of the last successful sync, null if never synced. */
  lastSyncAt: string | null;
  /** ISO timestamp of the last failed sync attempt, null if last attempt succeeded. */
  lastErrorAt: string | null;
  /** Number of consecutive failed attempts since last success. */
  retryCount: number;
}

function initialState(): SyncState {
  return {
    phase: "idle",
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    lastSyncAt: null,
    lastErrorAt: null,
    retryCount: 0,
  };
}

let state: SyncState = initialState();
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSyncState(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** @internal Called by syncService when a sync cycle starts. */
export function markSyncStarted(): void {
  setState({ phase: "syncing" });
}

/** @internal Called by syncService when a sync cycle fully succeeds. */
export function markSyncSuccess(lastSyncAt: string): void {
  setState({
    phase: "idle",
    lastSyncAt,
    lastErrorAt: null,
    retryCount: 0,
  });
}

/**
 * @internal Called by syncService when a sync cycle fails.
 * Pass null when retries are exhausted (no scheduled retry).
 */
export function markSyncFailed(retryCount: number): void {
  setState({
    phase: "idle",
    lastErrorAt: new Date().toISOString(),
    retryCount,
  });
}

/** @internal Called by syncService on online/offline events. */
export function setOnline(online: boolean): void {
  if (state.online !== online) {
    setState({ online });
  }
}

/** @internal Seeds the persisted lastSyncAt so UI is correct before first sync. */
export function seedLastSyncAt(lastSyncAt: string | null): void {
  if (state.lastSyncAt !== lastSyncAt) {
    setState({ lastSyncAt });
  }
}

/**
 * Reset to the initial values (used when switching accounts, so the previous
 * account's timestamps are never shown for the new one).
 */
export function resetSyncStatus(): void {
  setState(initialState());
}

/** Reset to initial values. Only for use in tests. */
export function _resetSyncStatus(): void {
  state = initialState();
}
