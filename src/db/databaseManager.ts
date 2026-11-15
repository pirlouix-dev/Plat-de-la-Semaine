import type { RxStorage } from "rxdb";
import type { AppDatabase, DatabaseCollections } from "./DatabaseContext";
import { dishesSchema, type DishDocType } from "./schemas/dishes";
import {
  preferencesSchema,
  type PreferenceDocType,
} from "./schemas/preferences";
import { hashFunction } from "./hashFunction";
import {
  LEGACY_DATABASE_NAME,
  claimLegacyDatabaseOwner,
  databaseNameForUser,
  isLegacyDatabaseMigrationDone,
  markLegacyDatabaseMigrationDone,
} from "./databaseName";

// RxDB's own `createRxDatabase`/`removeRxDatabase` signatures expose the
// storage as `RxStorage<any, any>`, so mirroring it avoids duplicating every
// storage generic in this module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRxStorage = RxStorage<any, any>;

export interface DatabaseManagerOptions {
  ignoreDuplicate?: boolean;
}

/** Open (creating if needed) one RxDB database with the app collections. */
export async function createAppDatabase(
  storage: AnyRxStorage,
  name: string,
  ignoreDuplicate = false,
): Promise<AppDatabase> {
  const { createRxDatabase } = await import("rxdb/plugins/core");

  const db = await createRxDatabase<DatabaseCollections>({
    name,
    storage,
    ignoreDuplicate,
    hashFunction,
  });

  await db.addCollections({
    dishes: { schema: dishesSchema },
    preferences: { schema: preferencesSchema },
  });

  return db as unknown as AppDatabase;
}

async function clearDatabase(db: AppDatabase): Promise<void> {
  await db.dishes.find().remove();
  await db.preferences.find().remove();
}

/**
 * Move locally-created guest dishes into the account that just logged in.
 *
 * Only `pending_create` documents are adopted: genuine guests cannot produce
 * `pending_update`/`pending_delete` (those need a `serverId`), so anything else
 * can only be a leftover from the old shared database and may belong to a
 * different account. Copying those would make them retry forever against a
 * server that cannot see them (#110).
 */
async function adoptGuestDishes(
  from: AppDatabase,
  to: AppDatabase,
): Promise<void> {
  const pending = await from.dishes
    .find({ selector: { syncStatus: "pending_create" } })
    .exec();

  for (const doc of pending) {
    const dish = doc.toJSON() as DishDocType;
    const existing = await to.dishes.findOne(dish.id).exec();
    if (!existing) {
      await to.dishes.insert(dish);
    }
  }

  // The guest data now belongs to the account; don't leave a second copy (or
  // stale legacy documents) behind for the next guest session.
  await clearDatabase(from);
}

/**
 * One-time migration of the pre-scoping shared database into the account that
 * owned it at upgrade time. The legacy database is removed once copied.
 */
async function migrateLegacyDatabase(
  storage: AnyRxStorage,
  target: AppDatabase,
  ignoreDuplicate: boolean,
): Promise<void> {
  const legacy = await createAppDatabase(
    storage,
    LEGACY_DATABASE_NAME,
    ignoreDuplicate,
  );

  try {
    const dishes = (await legacy.dishes.find().exec()).map(
      (doc) => doc.toJSON() as DishDocType,
    );
    const preferences = (await legacy.preferences.find().exec()).map(
      (doc) => doc.toJSON() as PreferenceDocType,
    );

    for (const dish of dishes) {
      await target.dishes.upsert(dish);
    }
    for (const preference of preferences) {
      await target.preferences.upsert(preference);
    }
  } finally {
    // Close on failure too, but only remove the legacy database after a
    // successful copy: an interrupted migration must be retried, not lost.
    await legacy.close().catch(() => false);
  }

  const { removeRxDatabase } = await import("rxdb/plugins/core");
  await removeRxDatabase(LEGACY_DATABASE_NAME, storage);
  markLegacyDatabaseMigrationDone();
}

/**
 * Owns the per-account databases. Operations are serialized so quick
 * login/logout/login sequences cannot leave two databases open for the same
 * account or publish a stale one.
 */
export class DatabaseManager {
  private queue: Promise<unknown> = Promise.resolve();
  private current: {
    name: string;
    userId: string | null;
    db: AppDatabase;
  } | null = null;

  private readonly storage: AnyRxStorage;
  private readonly options: DatabaseManagerOptions;

  constructor(
    storage: AnyRxStorage,
    options: DatabaseManagerOptions = {},
  ) {
    this.storage = storage;
    this.options = options;
  }

  /**
   * Open the database that belongs to `userId` (or the guest database when
   * null), running the one-time legacy migration or guest adoption when
   * needed. Previously opened databases stay on disk with their data.
   */
  openForUser(userId: string | null): Promise<AppDatabase> {
    return this.enqueue(async () => {
      const legacyOwner = claimLegacyDatabaseOwner(userId);
      const name = databaseNameForUser(userId, legacyOwner);

      if (this.current?.name === name) {
        // Retry a migration that failed on a previous open.
        try {
          await this.migrateLegacyIfNeeded(
            userId,
            legacyOwner,
            this.current.db,
          );
        } catch (err) {
          console.error("Local data migration failed:", err);
        }
        return this.current.db;
      }

      const previous = this.current;
      const db = await createAppDatabase(
        this.storage,
        name,
        this.options.ignoreDuplicate ?? false,
      );

      try {
        await this.migrateLegacyIfNeeded(userId, legacyOwner, db);

        if (previous?.userId === null && userId) {
          await adoptGuestDishes(previous.db, db);
        }
      } catch (err) {
        // Never block the app on a migration: the server sync can rebuild the
        // account state. The legacy database is kept for the next attempt.
        console.error("Local data migration failed:", err);
      }

      if (previous) {
        await previous.db.close().catch(() => false);
      }

      this.current = { name, userId, db };
      return db;
    });
  }

  /** Delete an account's local database (used after account deletion). */
  removeUserDatabase(userId: string): Promise<void> {
    return this.enqueue(async () => {
      const name = databaseNameForUser(userId, "");

      if (this.current?.name === name) {
        await this.current.db.close().catch(() => false);
        this.current = null;
      }

      const { removeRxDatabase } = await import("rxdb/plugins/core");
      await removeRxDatabase(name, this.storage);
    });
  }

  close(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.current) return;
      await this.current.db.close().catch(() => false);
      this.current = null;
    });
  }

  private async migrateLegacyIfNeeded(
    userId: string | null,
    legacyOwner: string,
    db: AppDatabase,
  ): Promise<void> {
    if (!userId || userId !== legacyOwner) return;
    if (isLegacyDatabaseMigrationDone()) return;

    await migrateLegacyDatabase(
      this.storage,
      db,
      this.options.ignoreDuplicate ?? false,
    );
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
