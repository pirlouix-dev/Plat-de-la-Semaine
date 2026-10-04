import type { AppDatabase } from "../db/DatabaseContext";
import type { DishDocType } from "../db/schemas/dishes";
import {
  getDishes,
  createDish,
  updateDish,
  deleteDish,
} from "./dishService";
import { regenerateDishId } from "../repositories/dishRepository";
import type { components } from "../schema";
import { isLoggedIn } from "./api";
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
      if (json.syncStatus === "pending_create") {
        const result = await createDish({
          id: json.id,
          name: json.name,
          description: json.description,
          course: json.course,
          seasons: json.seasons,
        });
        if (result.ok) {
          await doc.patch({
            serverId: String(result.data.id),
            syncStatus: "synced",
          });
        } else if (
          result.error.code === "CONFLICT" ||
          result.error.code === "HTTP_409"
        ) {
          await regenerateDishId(db, json.id);
          anyFailed = true;
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
        } else if (
          result.error.code === "NOT_FOUND" ||
          result.error.code === "HTTP_404"
        ) {
          await doc.remove();
        } else {
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

export async function sync(db: AppDatabase): Promise<void> {
  if (syncRunning) return;
  if (!isOnline()) return;
  if (!db?.dishes) return;
  if (!isLoggedIn()) return;

  syncRunning = true;
  markSyncStarted();
  try {
    const hadFailures = await pushPendingChanges(db);
    const pulledSyncAt = await pullAndMerge(db);

    if (hadFailures || pulledSyncAt === null) {
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
