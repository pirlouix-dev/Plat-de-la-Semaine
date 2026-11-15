import type { AppDatabase } from "../db/DatabaseContext";
import type { DishDocType } from "../db/schemas/dishes";
import {
  getDishes,
  createDish,
  updateDish,
  deleteDish,
} from "./dishService";
import { getMenu, saveMenu } from "./menuService";
import {
  applyRemoteMenu,
  getPendingRemoteMenu,
  isMenuDirty,
  keepLocalMenu,
  loadStoredMenu,
  markMenuMatchesRemote,
  markMenuPushSucceeded,
  sameStringArray,
  setPendingRemoteMenu,
} from "./menuStorage";
import type { RemoteMenu, StoredMenu } from "./menuStorage";
import type { components } from "../schema";
import { isLoggedIn, getCurrentUserId } from "./api";
import {
  markSyncStarted,
  markSyncSuccess,
  markSyncFailed,
  setOnline,
  seedLastSyncAt,
  _resetSyncStatus,
} from "./syncStatusStore";

type ApiDish = components["schemas"]["Dish"];

const BACKOFF_DELAYS_MS = [1_000, 5_000, 15_000, 30_000, 60_000];
const LAST_SYNC_KEY = "lastSyncAt";
const SYNC_INTERVAL_MS = 3_600_000;

let syncRunning = false;
let retryCount = 0;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncInterval: ReturnType<typeof setInterval> | null = null;

/** @internal Reset module-level sync state. Only for use in tests. */
export function _resetSyncState(): void {
  syncRunning = false;
  retryCount = 0;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  _resetSyncStatus();
}

function isOnline(): boolean {
  return navigator.onLine;
}

export async function getLastSyncAt(db: AppDatabase): Promise<string | null> {
  if (!db?.preferences) return null;
  const doc = await db.preferences.findOne(LAST_SYNC_KEY).exec();
  return doc ? (doc.toJSON().value as string) : null;
}

async function setLastSyncAt(db: AppDatabase, isoDate: string): Promise<void> {
  if (!db?.preferences) return;
  await db.preferences.upsert({
    key: LAST_SYNC_KEY,
    value: isoDate,
    updatedAt: isoDate,
  });
}

function mapApiDishToLocal(apiDish: ApiDish): DishDocType {
  return {
    id: String(apiDish.id ?? crypto.randomUUID()),
    serverId: String(apiDish.id),
    name: String(apiDish.name ?? ""),
    description: String(apiDish.description ?? ""),
    course: Number(apiDish.course ?? 1),
    seasons: (apiDish.seasons ?? []).map(Number),
    updatedAt: String(apiDish.updatedAt ?? new Date().toISOString()),
    isDeleted: Boolean(apiDish.isDeleted),
    syncStatus: "synced",
  };
}

async function pushPendingChanges(db: AppDatabase): Promise<boolean> {
  const docs = await db.dishes
    .find({
      selector: { syncStatus: { $ne: "synced" } },
    })
    .exec();

  let anyFailed = false;

  for (const doc of docs) {
    const json = doc.toJSON() as DishDocType;

    try {
      if (json.syncStatus === "pending_create" && json.isDeleted) {
        // A draft deleted before its first sync never reached the server:
        // drop it locally instead of creating it remotely.
        await doc.remove();
        continue;
      }

      if (json.syncStatus === "pending_create") {
        const result = await createDish({
          id: json.id,
          name: json.name,
          description: json.description,
          course: json.course,
          seasons: json.seasons,
        });
        if (result.ok) {
          const current = await db.dishes.findOne(json.id).exec();
          if (!current) {
            // Deleted locally while the POST was in flight: undo the creation
            // so the dish is not pulled back as a live one.
            await deleteDish(String(result.data.id));
          } else {
            await current.patch({
              serverId: String(result.data.id),
              syncStatus: "synced",
            });
          }
        } else {
          anyFailed = true;
        }
      } else if (json.syncStatus === "pending_update" && json.serverId) {
        const result = await updateDish(json.serverId, {
          name: json.name,
          description: json.description,
          course: json.course,
          seasons: json.seasons,
        });
        if (result.ok) {
          await doc.patch({ syncStatus: "synced" });
        } else {
          // A 404 can mean the dish belongs to another account (the local DB is
          // shared across logins), so it is transient and must not be dropped.
          anyFailed = true;
        }
      } else if (json.syncStatus === "pending_delete" && json.serverId) {
        const result = await deleteDish(json.serverId);
        if (result.ok) {
          await doc.remove();
        } else {
          anyFailed = true;
        }
      }
    } catch {
      anyFailed = true;
    }
  }

  return anyFailed;
}

const STALE_SYNC_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

function isSyncStale(lastSyncAt: string): boolean {
  return Date.now() - new Date(lastSyncAt).getTime() > STALE_SYNC_THRESHOLD_MS;
}

/**
 * Pulls remote dishes and merges them locally.
 * Returns the persisted lastSyncAt ISO timestamp on success, null on failure.
 * @param forceFullSync ignores the stored last sync date and fetches everything.
 */
async function pullAndMerge(
  db: AppDatabase,
  options?: { forceFullSync?: boolean },
): Promise<string | null> {
  const lastSyncAt = await getLastSyncAt(db);
  const syncStartTime = new Date().toISOString();
  const needsFullSync =
    !!options?.forceFullSync || !lastSyncAt || isSyncStale(lastSyncAt);

  const result = await getDishes({ since: needsFullSync ? undefined : lastSyncAt });
  if (!result.ok) return null;

  const remoteDishes = result.data;

  const existingDocs = await db.dishes.find().exec();
  const existingById = new Map<string, DishDocType>();
  const existingByServerId = new Map<string, DishDocType>();
  for (const doc of existingDocs) {
    const json = doc.toJSON() as DishDocType;
    existingById.set(json.id, json);
    if (json.serverId) {
      existingByServerId.set(json.serverId, json);
    }
  }

  for (const remote of remoteDishes) {
    const localDish = mapApiDishToLocal(remote);
    const matchByServerId = remote.id
      ? existingByServerId.get(String(remote.id))
      : undefined;

    if (!matchByServerId) {
      if (remote.isDeleted) continue;
      // Skip if a local dish already has this ID (UUID collision with an unsynced local draft)
      if (!existingById.has(localDish.id)) {
        await db.dishes.upsert(localDish);
      }
      continue;
    }

    if (matchByServerId.syncStatus !== "synced") continue;

    const localUpdated = new Date(matchByServerId.updatedAt).getTime();
    const remoteUpdated = new Date(localDish.updatedAt).getTime();

    if (remoteUpdated >= localUpdated) {
      if (remote.isDeleted) {
        const doc = await db.dishes.findOne(matchByServerId.id).exec();
        if (doc) await doc.remove();
      } else {
        const doc = await db.dishes.findOne(matchByServerId.id).exec();
        if (doc) {
          await doc.patch({
            name: localDish.name,
            description: localDish.description,
            course: localDish.course,
            seasons: localDish.seasons,
            updatedAt: localDish.updatedAt,
            isDeleted: localDish.isDeleted,
            serverId: localDish.serverId,
            syncStatus: "synced",
          });
        }
      }
    }
  }

  if (needsFullSync) {
    const remoteServerIds = new Set(
      remoteDishes.map((d) => String(d.id))
    );
    for (const doc of existingDocs) {
      const json = doc.toJSON() as DishDocType;
      if (
        json.syncStatus === "synced" &&
        json.serverId &&
        !remoteServerIds.has(json.serverId)
      ) {
        await doc.remove();
      }
    }
  }

  await setLastSyncAt(db, syncStartTime);

  return syncStartTime;
}

/**
 * Force a full pull of remote dishes and merge them into the local database.
 * Used after operations that mutate data server-side (e.g. bulk import) so the
 * local store reflects the result without waiting for the next scheduled sync.
 * Returns `true` when the pull succeeded.
 */
export async function refreshFromServer(db: AppDatabase): Promise<boolean> {
  if (!isOnline() || !db?.dishes || !isLoggedIn()) return false;
  const result = await pullAndMerge(db, { forceFullSync: true });
  return result !== null;
}

const MENU_CONFLICT_CODE = "MENU_VERSION_CONFLICT";

let menuWriteInFlight = false;

function remoteFromApiMenu(menu: components["schemas"]["Menu"]): RemoteMenu {
  return {
    selectedDishIds: (menu.selectedDishIds ?? []).map(String),
    updatedAt: menu.updatedAt ?? null,
  };
}

/**
 * Fractional-second digits of an ISO 8601 timestamp, padded to nanoseconds.
 * `Date.parse` only keeps milliseconds, but server versions are microseconds
 * apart, so comparing it alone can merge two distinct versions.
 */
function fractionalNanoseconds(value: string): string {
  const match = /\.(\d+)/.exec(value);
  return (match?.[1] ?? "").padEnd(9, "0").slice(0, 9);
}

/** Compares two server timestamps at full sub-millisecond precision. */
function compareRemoteVersions(a: string, b: string): number {
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (aMs !== bMs) return aMs < bMs ? -1 : 1;

  const aFraction = fractionalNanoseconds(a);
  const bFraction = fractionalNanoseconds(b);
  if (aFraction === bFraction) return 0;
  return aFraction < bFraction ? -1 : 1;
}

function sameRemoteVersion(
  a: string | null,
  b: string | null,
): boolean {
  if (a === null || b === null) return a === b;
  return compareRemoteVersions(a, b) === 0;
}

function isRemoteOlder(
  remoteUpdatedAt: string | null,
  knownUpdatedAt: string | null,
): boolean {
  if (!remoteUpdatedAt || !knownUpdatedAt) return false;
  return compareRemoteVersions(remoteUpdatedAt, knownUpdatedAt) < 0;
}

/**
 * Resolve a remote menu against the local document.
 *
 * The banner is intentionally driven by "new remote version + dirty local
 * state", not by comparing the remote timestamp with the last local edit. A
 * remote menu can be older than the latest edit but still be a version this
 * device has never seen, and the user may prefer it.
 */
async function handleRemoteMenu(
  userId: string,
  remote: RemoteMenu,
): Promise<boolean> {
  const stored = loadStoredMenu(userId);

  if (!stored) {
    if (remote.updatedAt) {
      applyRemoteMenu(userId, remote);
    }
    return true;
  }

  if (remote.updatedAt === null) {
    // The server has no menu. Push a pending save/clear; otherwise keep the
    // local draft (it may never have been validated).
    if (stored.pendingSave) return pushPendingMenu();
    return true;
  }

  if (
    stored.serverUpdatedAt &&
    sameRemoteVersion(remote.updatedAt, stored.serverUpdatedAt)
  ) {
    // Same version we already know about: only a pending save needs attention.
    if (stored.pendingSave) {
      if (sameStringArray(remote.selectedDishIds, stored.savedIds)) {
        markMenuMatchesRemote(userId, remote);
        return true;
      }
      return pushPendingMenu();
    }
    return true;
  }

  if (isRemoteOlder(remote.updatedAt, stored.serverUpdatedAt)) {
    // A stale GET response (e.g. it returned after our own successful PUT).
    return true;
  }

  if (
    sameStringArray(remote.selectedDishIds, stored.savedIds) ||
    sameStringArray(remote.selectedDishIds, stored.selectedIds)
  ) {
    markMenuMatchesRemote(userId, remote);
    return true;
  }

  if (!isMenuDirty(stored)) {
    applyRemoteMenu(userId, remote);
    return true;
  }

  // The local menu was modified and the server has a version we have not seen.
  // Ask the user instead of silently replacing either side.
  setPendingRemoteMenu(userId, remote);
  return true;
}

/**
 * Push the saved snapshot when it is still pending. Returns `true` when there is
 * nothing left to retry, `false` on a transient failure.
 */
async function pushPendingMenu(): Promise<boolean> {
  if (menuWriteInFlight) return true;

  const userId = getCurrentUserId();
  if (!userId) return true;

  if (getPendingRemoteMenu(userId)) return true;

  const stored = loadStoredMenu(userId);
  if (!stored?.pendingSave) return true;
  if (!isOnline()) return false;

  menuWriteInFlight = true;
  try {
    for (;;) {
      const current = loadStoredMenu(userId);
      if (!current?.pendingSave) return true;
      if (getPendingRemoteMenu(userId)) return true;

      const snapshot = {
        saveRevision: current.saveRevision,
        localRevision:
          current.pendingLocalRevision ?? current.localRevision,
      };

      const result = await saveMenu({
        selectedDishIds: current.savedIds,
        expectedUpdatedAt: current.serverUpdatedAt,
      });

      if (result.ok) {
        const remote = remoteFromApiMenu(result.data);
        markMenuPushSucceeded(userId, snapshot, remote);

        const after = loadStoredMenu(userId);
        if (after?.pendingSave && after.saveRevision !== snapshot.saveRevision) {
          // A newer explicit save/clear happened while this request was in
          // flight. Push that snapshot against the version we just received.
          continue;
        }
        return true;
      }

      if (result.error.code === MENU_CONFLICT_CODE) {
        // The server changed under us. Pull the current version and let the
        // shared resolver decide whether to adopt, push, or ask the user.
        menuWriteInFlight = false;
        return pullAndResolveMenu(userId);
      }

      return false;
    }
  } finally {
    menuWriteInFlight = false;
  }
}

/**
 * Pull the server menu and resolve it against local state.
 * Returns `false` only when the request failed and should be retried.
 */
async function pullAndResolveMenu(userId?: string): Promise<boolean> {
  const currentUserId = userId ?? getCurrentUserId();
  if (!currentUserId) return true;

  const pending = loadStoredMenu(currentUserId)?.pendingSave ?? false;
  if (!isOnline()) return !pending;
  if (menuWriteInFlight) {
    // A save is already resolving the menu; its response (or 409 follow-up)
    // will decide the outcome.
    return true;
  }

  const result = await getMenu();
  if (!result.ok) return false;

  if (menuWriteInFlight) {
    // A save started while the GET was in flight. Its response is authoritative.
    return true;
  }

  return handleRemoteMenu(currentUserId, remoteFromApiMenu(result.data));
}

/** Push the pending saved menu immediately after a validate/clear action. */
export async function saveMenuNow(): Promise<void> {
  if (!isLoggedIn() || !isOnline()) return;
  await pushPendingMenu();
}

/**
 * Resolve the banner choice.
 * - "load": adopt the remote menu and discard the local working state.
 * - "keep": acknowledge the remote version and push the local saved snapshot.
 */
export async function resolveMenuConflict(
  choice: "load" | "keep",
): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;

  const remote = getPendingRemoteMenu(userId);
  if (!remote) return;

  if (choice === "load") {
    applyRemoteMenu(userId, remote);
    return;
  }

  const stored = keepLocalMenu(userId, remote);
  if (stored?.pendingSave) {
    await pushPendingMenu();
  }
}

/** @internal Current local menu document, for UI/tests. */
export function getLocalMenu(userId: string | null): StoredMenu | null {
  return loadStoredMenu(userId);
}

export async function sync(db: AppDatabase): Promise<void> {
  if (syncRunning) return;
  if (!isOnline()) return;
  if (!db?.dishes) return;
  if (!isLoggedIn()) return;

  syncRunning = true;
  markSyncStarted();
  try {
    // Start the menu pull immediately; it must not wait behind dish operations.
    const menuResolved = pullAndResolveMenu();
    const hadFailures = await pushPendingChanges(db);
    const pulledSyncAt = await pullAndMerge(db);
    const menuSucceeded = await menuResolved;

    if (hadFailures || pulledSyncAt === null || !menuSucceeded) {
      retryCount += 1;
      const delay =
        BACKOFF_DELAYS_MS[
          Math.min(retryCount - 1, BACKOFF_DELAYS_MS.length - 1)
        ];
      scheduleRetry(db, delay);
      markSyncFailed(retryCount);
    } else {
      retryCount = 0;
      markSyncSuccess(pulledSyncAt);
    }
  } finally {
    syncRunning = false;
  }
}

function scheduleRetry(db: AppDatabase, delayMs: number): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void sync(db);
  }, delayMs);
}

function scheduleNextSync(db: AppDatabase): void {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  syncInterval = setInterval(() => {
    void sync(db);
  }, SYNC_INTERVAL_MS);
}

export function startAutoSync(db: AppDatabase): () => void {
  if (!isLoggedIn()) {
    return () => {};
  }

  const onOnline = () => {
    setOnline(true);
    void sync(db).then(() => scheduleNextSync(db));
  };

  const onOffline = () => {
    setOnline(false);
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  setOnline(navigator.onLine);
  void getLastSyncAt(db).then(seedLastSyncAt);

  scheduleNextSync(db);

  if (isOnline()) {
    void sync(db).then(() => scheduleNextSync(db));
  }

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  };
}
