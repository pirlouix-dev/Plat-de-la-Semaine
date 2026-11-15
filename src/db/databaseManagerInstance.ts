import { DatabaseManager } from "./databaseManager";

let managerPromise: Promise<DatabaseManager> | null = null;

/** Lazily create the app-wide manager (and the RxDB storage it owns). */
export async function getDatabaseManager(): Promise<DatabaseManager> {
  if (!managerPromise) {
    managerPromise = (async () => {
      if (import.meta.env.DEV) {
        const { RxDBDevModePlugin } = await import("rxdb/plugins/dev-mode");
        const { addRxPlugin } = await import("rxdb/plugins/core");
        addRxPlugin(RxDBDevModePlugin);
      }

      const { getRxStorageDexie } =
        await import("rxdb/plugins/storage-dexie");
      const { wrappedValidateAjvStorage } =
        await import("rxdb/plugins/validate-ajv");

      const storage = wrappedValidateAjvStorage({
        storage: getRxStorageDexie(),
      });

      return new DatabaseManager(storage, {
        ignoreDuplicate: import.meta.env.DEV,
      });
    })();
  }

  return managerPromise;
}

/**
 * Delete the local database that belongs to a deleted account, so their dishes
 * do not stay on disk after the account is gone.
 */
export async function removeLocalDatabaseForUser(
  userId: string,
): Promise<void> {
  const manager = await getDatabaseManager();
  await manager.removeUserDatabase(userId);
}

/** @internal Reset the shared database manager. Only for use in tests. */
export async function _resetDatabaseManager(): Promise<void> {
  if (!managerPromise) return;

  try {
    const manager = await managerPromise;
    await manager.close();
  } catch {
    // Ignore teardown failures in tests
  }
  managerPromise = null;
}
