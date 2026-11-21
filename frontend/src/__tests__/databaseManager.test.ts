import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import {
  addRxPlugin,
  removeRxDatabase,
} from "rxdb/plugins/core";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import type { DishDocType } from "../db/schemas/dishes";
import { insertDish } from "../repositories/dishRepository";
import {
  DatabaseManager,
  createAppDatabase,
} from "../db/databaseManager";
import {
  GUEST_DATABASE_NAME,
  LEGACY_DATABASE_NAME,
  _resetDatabaseNaming,
  databaseNameForUser,
  isLegacyDatabaseMigrationDone,
} from "../db/databaseName";

vi.mock("../services/dishService", () => ({
  getDishes: vi.fn(),
  applyDishBatch: vi.fn(),
  DISH_BATCH_MAX_OPERATIONS: 500,
}));

vi.mock("../services/menuService", () => ({
  getMenu: vi.fn(),
  saveMenu: vi.fn(),
}));

import { getDishes, applyDishBatch } from "../services/dishService";
import { getMenu } from "../services/menuService";
import { sync, _resetSyncState } from "../services/syncService";

addRxPlugin(RxDBDevModePlugin);

const mockGetDishes = vi.mocked(getDishes);
const mockApplyDishBatch = vi.mocked(applyDishBatch);
const mockGetMenu = vi.mocked(getMenu);

const storage = wrappedValidateAjvStorage({
  storage: getRxStorageDexie(),
});

const usedUserIds = new Set<string>();

function newUserId(): string {
  const userId = "user-" + crypto.randomUUID();
  usedUserIds.add(userId);
  return userId;
}

function makeDish(overrides: Partial<DishDocType> = {}): DishDocType {
  return {
    id: crypto.randomUUID(),
    serverId: "",
    name: "Test Dish",
    description: "A test dish",
    course: 1,
    seasons: [0, 1],
    updatedAt: "2026-01-01T00:00:00.000Z",
    isDeleted: false,
    syncStatus: "synced",
    ...overrides,
  };
}

let manager: DatabaseManager;

beforeEach(() => {
  localStorage.clear();
  _resetDatabaseNaming();
  _resetSyncState();
  vi.resetAllMocks();

  mockGetDishes.mockResolvedValue({ ok: true, data: [] });
  mockGetMenu.mockResolvedValue({
    ok: true,
    data: { selectedDishIds: [], updatedAt: null },
  });
  vi.stubGlobal("navigator", { onLine: true });

  manager = new DatabaseManager(storage, { ignoreDuplicate: true });
});

afterEach(async () => {
  await manager.close();

  for (const userId of usedUserIds) {
    await removeRxDatabase(
      databaseNameForUser(userId, ""),
      storage,
    ).catch(() => undefined);
  }
  usedUserIds.clear();

  await removeRxDatabase(LEGACY_DATABASE_NAME, storage).catch(
    () => undefined,
  );
  await removeRxDatabase(GUEST_DATABASE_NAME, storage).catch(
    () => undefined,
  );

  vi.unstubAllGlobals();
});

describe("databaseNameForUser", () => {
  it("keeps guests on the legacy database until an account claims it", () => {
    expect(databaseNameForUser(null, "")).toBe(LEGACY_DATABASE_NAME);
    expect(databaseNameForUser(null, "user-a")).toBe(GUEST_DATABASE_NAME);
  });

  it("gives each account a distinct RxDB-valid database name", () => {
    const a = databaseNameForUser("user-a", "");
    const b = databaseNameForUser("user-b", "");

    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z][_$a-zA-Z0-9-]*$/);
    expect(databaseNameForUser("user-a", "user-b")).toBe(a);
  });
});

describe("DatabaseManager", () => {
  it("keeps a user's pending changes across a logout and a later login", async () => {
    const userId = newUserId();

    const first = await manager.openForUser(userId);
    await insertDish(
      first,
      makeDish({
        id: "a-pending",
        syncStatus: "pending_update",
        serverId: "server-a",
      }),
    );

    await manager.openForUser(null);

    const second = await manager.openForUser(userId);
    const docs = await second.dishes.find().exec();

    expect(docs.map((doc) => doc.id)).toEqual(["a-pending"]);
  });

  it("does not expose or push the previous account's pending changes to another account", async () => {
    const userA = newUserId();
    const userB = newUserId();

    const dbA = await manager.openForUser(userA);
    await insertDish(
      dbA,
      makeDish({
        id: "a-pending",
        syncStatus: "pending_update",
        serverId: "server-a",
      }),
    );

    const dbB = await manager.openForUser(userB);
    expect(await dbB.dishes.find().exec()).toHaveLength(0);

    localStorage.setItem("user_id", userB);
    await sync(dbB);

    expect(mockApplyDishBatch).not.toHaveBeenCalled();

    localStorage.setItem("user_id", userA);
    mockApplyDishBatch.mockResolvedValue({
      ok: true,
      data: {
        created: 0,
        updated: 1,
        deleted: 0,
        failed: 0,
        results: [
          {
            index: 0,
            op: "update",
            status: "updated",
            id: "server-a",
            data: {
              id: "server-a",
              userId: userA,
              name: "Test Dish",
              description: "A test dish",
              course: 1,
              seasons: [0, 1],
              updatedAt: "2026-01-02T00:00:00.000Z",
              isDeleted: false,
            },
          },
        ],
      },
    });

    const dbAAgain = await manager.openForUser(userA);
    await sync(dbAAgain);

    expect(mockApplyDishBatch).toHaveBeenCalledWith({
      operations: [expect.objectContaining({ op: "update", id: "server-a" })],
    });
  });

  it("adopts guest-created dishes but not ambiguous legacy changes", async () => {
    const guestDb = await manager.openForUser(null);
    await insertDish(
      guestDb,
      makeDish({ id: "guest-create", syncStatus: "pending_create" }),
    );
    await insertDish(
      guestDb,
      makeDish({
        id: "legacy-update",
        syncStatus: "pending_update",
        serverId: "old-server",
      }),
    );
    await insertDish(
      guestDb,
      makeDish({
        id: "legacy-synced",
        syncStatus: "synced",
        serverId: "old-server-2",
      }),
    );

    const userId = newUserId();
    const db = await manager.openForUser(userId);

    const ids = (await db.dishes.find().exec())
      .map((doc) => doc.id)
      .sort();
    expect(ids).toEqual(["guest-create"]);

    // The adopted documents were moved, not duplicated for the next guest.
    const guestAgain = await manager.openForUser(null);
    expect(await guestAgain.dishes.find().exec()).toHaveLength(0);
  });

  it("migrates the legacy shared database into the account that owned it", async () => {
    const legacy = await createAppDatabase(
      storage,
      LEGACY_DATABASE_NAME,
      true,
    );
    await insertDish(
      legacy,
      makeDish({
        id: "legacy-pending",
        syncStatus: "pending_update",
        serverId: "legacy-server",
      }),
    );
    await legacy.preferences.upsert({
      key: "lastSyncAt",
      value: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await legacy.close();

    const userId = newUserId();
    const db = await manager.openForUser(userId);

    const docs = await db.dishes.find().exec();
    expect(docs.map((doc) => doc.id)).toEqual(["legacy-pending"]);

    const lastSyncAt = await db.preferences.findOne("lastSyncAt").exec();
    expect(lastSyncAt?.get("value")).toBe("2026-01-01T00:00:00.000Z");
    expect(isLegacyDatabaseMigrationDone()).toBe(true);
  });
});
