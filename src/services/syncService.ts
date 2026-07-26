import type { AppDatabase } from "../db/DatabaseContext";
import type { DishDocType } from "../db/schemas/dishes";
import {
  getDishes,
  createDish,
  updateDish,
  deleteDish,
} from "./dishService";
import type { components } from "../schema";

type ApiDish = components["schemas"]["Dish"];

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_RETRIES = 5;

let syncRunning = false;
let retryCount = 0;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Reset module-level sync state. Only for use in tests. */
export function _resetSyncState(): void {
  syncRunning = false;
  retryCount = 0;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

function isOnline(): boolean {
  return navigator.onLine;
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

async function pullAndMerge(db: AppDatabase): Promise<void> {
  const result = await getDishes();
  if (!result.ok) return;

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
      if (!existingById.has(localDish.id)) {
        await db.dishes.upsert(localDish);
      }
      continue;
    }

    if (matchByServerId.syncStatus !== "synced") continue;

    const localUpdated = new Date(matchByServerId.updatedAt).getTime();
    const remoteUpdated = new Date(localDish.updatedAt).getTime();

    if (remoteUpdated >= localUpdated) {
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

export async function sync(db: AppDatabase): Promise<void> {
  if (syncRunning) return;
  if (!isOnline()) return;
  if (!db?.dishes) return;

  syncRunning = true;
  try {
    const hadFailures = await pushPendingChanges(db);
    await pullAndMerge(db);

    if (hadFailures) {
      retryCount = Math.min(retryCount + 1, MAX_RETRIES);
      const delay = Math.min(
        INITIAL_BACKOFF_MS * Math.pow(2, retryCount - 1),
        MAX_BACKOFF_MS
      );
      scheduleRetry(db, delay);
    } else {
      retryCount = 0;
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

export function startAutoSync(db: AppDatabase): () => void {
  const onOnline = () => {
    void sync(db);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible" && isOnline()) {
      void sync(db);
    }
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibilityChange);

  if (isOnline()) {
    void sync(db);
  }

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
  };
}
