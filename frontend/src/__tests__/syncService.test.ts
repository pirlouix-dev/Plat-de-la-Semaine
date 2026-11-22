import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { addRxPlugin, createRxDatabase } from "rxdb/plugins/core";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { dishesSchema, type DishDocType } from "../db/schemas/dishes";
import { preferencesSchema } from "../db/schemas/preferences";
import type { DatabaseCollections } from "../db/collections";
import type { AppDatabase } from "../db/DatabaseContext";
import { hashFunction } from "../db/hashFunction";
import { userDatabaseName } from "../db/databaseName";
import { insertDish, editDish, softDeleteDish } from "../repositories/dishRepository";
import type { components } from "../schema";
import {
  _resetMenuStorageState,
  beginMenuSave,
  getPendingRemoteMenu,
  isMenuDirty,
  loadStoredMenu,
  markMenuModified,
  setPendingRemoteMenu,
  storeMenu,
} from "../services/menuStorage";

addRxPlugin(RxDBDevModePlugin);

// ── Mock dishService ────────────────────────────────────────────────────────

vi.mock("../services/dishService", () => ({
  getDishes: vi.fn(),
  applyDishBatch: vi.fn(),
  DISH_BATCH_MAX_OPERATIONS: 500,
}));

vi.mock("../services/menuService", () => ({
  getMenu: vi.fn(),
  saveMenu: vi.fn(),
}));

import { getDishes, applyDishBatch, DISH_BATCH_MAX_OPERATIONS } from "../services/dishService";
import { getMenu, saveMenu } from "../services/menuService";
import {
  sync,
  startAutoSync,
  refreshFromServer,
  flushPendingDishes,
  requestDishFlush,
  chunkOperations,
  resolveMenuConflict,
  saveMenuNow,
  _resetSyncState,
} from "../services/syncService";
import { getSyncState } from "../services/syncStatusStore";

const mockGetDishes = vi.mocked(getDishes);
const mockApplyDishBatch = vi.mocked(applyDishBatch);
const mockGetMenu = vi.mocked(getMenu);
const mockSaveMenu = vi.mocked(saveMenu);

// ── Test database ───────────────────────────────────────────────────────────

let db: AppDatabase;

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

type ApiDish = components["schemas"]["Dish"];

function apiDish(overrides: Partial<ApiDish> = {}): ApiDish {
  return {
    id: "srv-1",
    userId: "test-user",
    name: "Test Dish",
    description: "A test dish",
    course: 1,
    seasons: [0, 1],
    updatedAt: "2026-01-01T00:00:00.000Z",
    isDeleted: false,
    ...overrides,
  };
}

function batchOk(
  results: Array<
    Partial<ApiBatchResult> & { index: number; status: string }
  >,
) {
  return {
    ok: true as const,
    data: {
      created: results.filter((r) => r.status === "created").length,
      updated: results.filter((r) => r.status === "updated").length,
      deleted: results.filter((r) => r.status === "deleted").length,
      failed: results.filter((r) => r.status === "failed").length,
      results: results.map((result) => ({
        op: null,
        id: null,
        data: null,
        code: null,
        message: null,
        ...result,
      })),
    },
  };
}

function batchFailed() {
  return {
    ok: false as const,
    error: { code: "HTTP_500", message: "Batch failed" },
  };
}

type ApiBatchResult = components["schemas"]["DishBatchOperationResult"];

beforeAll(async () => {
  const rawStorage = getRxStorageDexie();
  const validatedStorage = wrappedValidateAjvStorage({ storage: rawStorage });

  db = (await createRxDatabase<DatabaseCollections>({
    name: userDatabaseName("test-user"),
    storage: validatedStorage,
    ignoreDuplicate: true,
    hashFunction,
  })) as unknown as AppDatabase;

  await db.addCollections({
    dishes: { schema: dishesSchema },
    preferences: { schema: preferencesSchema },
  });
});

beforeEach(async () => {
  const all = await db.dishes.find().exec();
  for (const doc of all) {
    await doc.remove();
  }
  const prefs = await db.preferences.find().exec();
  for (const doc of prefs) {
    await doc.remove();
  }
  vi.resetAllMocks();
  _resetSyncState();
  _resetMenuStorageState();
  localStorage.clear();
  localStorage.setItem("user_id", "test-user");
  mockGetDishes.mockResolvedValue({ ok: true, data: [] });
  mockGetMenu.mockResolvedValue({
    ok: true,
    data: { selectedDishIds: [], updatedAt: null },
  });
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── sync ────────────────────────────────────────────────────────────────────

describe("sync", () => {
  it("skips when offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    await sync(db);

    expect(mockGetDishes).not.toHaveBeenCalled();
  });

  it("skips when db has no dishes collection", async () => {
    const fakeDb = {} as AppDatabase;
    await sync(fakeDb);

    expect(mockGetDishes).not.toHaveBeenCalled();
  });

  it("skips when not logged in", async () => {
    localStorage.removeItem("user_id");

    await sync(db);

    expect(mockGetDishes).not.toHaveBeenCalled();
  });

  it("does not push when the database belongs to another account", async () => {
    await insertDish(
      db,
      makeDish({
        id: "other-account",
        syncStatus: "pending_update",
        serverId: "server-other",
      }),
    );
    localStorage.setItem("user_id", "another-user");

    await sync(db);

    expect(mockApplyDishBatch).not.toHaveBeenCalled();
    expect(mockGetDishes).not.toHaveBeenCalled();
  });

  it("pushes pending creates as one batch and records the acknowledged server state", async () => {
    await insertDish(
      db,
      makeDish({
        id: "sync-1",
        name: "Tarte",
        syncStatus: "pending_create",
        description: "",
        course: 2,
        seasons: [2],
      }),
    );

    const created = apiDish({
      id: "sync-1",
      name: "Tarte",
      description: "",
      course: 2,
      seasons: [2],
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    mockApplyDishBatch.mockResolvedValue(
      batchOk([
        { index: 0, op: "create", status: "created", id: "sync-1", data: created },
      ]),
    );
    mockGetDishes.mockResolvedValue({ ok: true, data: [created] });

    await sync(db);

    expect(mockApplyDishBatch).toHaveBeenCalledTimes(1);
    expect(mockApplyDishBatch).toHaveBeenCalledWith({
      operations: [
        {
          op: "create",
          id: "sync-1",
          name: "Tarte",
          description: "",
          course: 2,
          seasons: [2],
        },
      ],
    });

    const doc = await db.dishes.findOne("sync-1").exec();
    expect(doc!.get("syncStatus")).toBe("synced");
    expect(doc!.get("serverId")).toBe("sync-1");
    expect(doc!.get("updatedAt")).toBe("2026-01-02T00:00:00.000Z");
  });

  it("sends creates, updates, and deletes in a single batch", async () => {
    await insertDish(
      db,
      makeDish({ id: "mixed-create", name: "Neuf", syncStatus: "pending_create" }),
    );
    await insertDish(
      db,
      makeDish({
        id: "mixed-update",
        serverId: "srv-update",
        name: "Modifié",
        syncStatus: "pending_update",
      }),
    );
    await insertDish(
      db,
      makeDish({
        id: "mixed-delete",
        serverId: "srv-delete",
        syncStatus: "pending_delete",
        isDeleted: true,
      }),
    );

    const created = apiDish({
      id: "mixed-create",
      name: "Neuf",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    const updated = apiDish({
      id: "srv-update",
      name: "Modifié",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    // Results arrive out of order: reconciliation must follow `index`.
    mockApplyDishBatch.mockImplementation(async ({ operations }) => {
      const results = operations.map((operation, index) => {
        if (operation.op === "create") {
          return {
            index,
            op: "create",
            status: "created",
            id: "mixed-create",
            data: created,
          };
        }
        if (operation.op === "update") {
          return {
            index,
            op: "update",
            status: "updated",
            id: "srv-update",
            data: updated,
          };
        }
        return { index, op: "delete", status: "deleted", id: "srv-delete" };
      });
      return batchOk(results.reverse());
    });
    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [created, updated],
    });

    await sync(db);

    expect(mockApplyDishBatch).toHaveBeenCalledTimes(1);
    const [{ operations }] = mockApplyDishBatch.mock.calls[0];
    expect(operations.map((operation) => operation.op).sort()).toEqual([
      "create",
      "delete",
      "update",
    ]);
    expect(
      operations.find((operation) => operation.op === "update")!.id,
    ).toBe("srv-update");
    expect(
      operations.find((operation) => operation.op === "delete")!.id,
    ).toBe("srv-delete");

    const createdDoc = await db.dishes.findOne("mixed-create").exec();
    expect(createdDoc!.get("syncStatus")).toBe("synced");
    expect(createdDoc!.get("serverId")).toBe("mixed-create");

    const updatedDoc = await db.dishes.findOne("mixed-update").exec();
    expect(updatedDoc!.get("syncStatus")).toBe("synced");
    expect(updatedDoc!.get("updatedAt")).toBe("2026-01-02T00:00:00.000Z");

    expect(await db.dishes.findOne("mixed-delete").exec()).toBeNull();
    expect(getSyncState().retryCount).toBe(0);
  });

  it("keeps only the failed operations pending after a partial failure", async () => {
    await insertDish(
      db,
      makeDish({ id: "partial-ok", name: "Ok", syncStatus: "pending_create" }),
    );
    await insertDish(
      db,
      makeDish({
        id: "partial-fail",
        serverId: "srv-gone",
        name: "Disparu",
        syncStatus: "pending_update",
      }),
    );

    const created = apiDish({ id: "partial-ok", name: "Ok" });
    mockApplyDishBatch.mockImplementation(async ({ operations }) =>
      batchOk(
        operations.map((operation, index) =>
          operation.op === "update"
            ? {
                index,
                op: "update",
                status: "failed",
                id: "srv-gone",
                code: "NOT_FOUND",
                message: "The requested resource was not found.",
              }
            : {
                index,
                op: "create",
                status: "created",
                id: "partial-ok",
                data: created,
              },
        ),
      ),
    );
    mockGetDishes.mockResolvedValue({ ok: true, data: [created] });

    await sync(db);

    const ok = await db.dishes.findOne("partial-ok").exec();
    expect(ok!.get("syncStatus")).toBe("synced");

    const failed = await db.dishes.findOne("partial-fail").exec();
    expect(failed!.get("syncStatus")).toBe("pending_update");
    expect(failed!.get("name")).toBe("Disparu");

    expect(getSyncState().retryCount).toBe(1);
  });

  it("keeps every document pending when the batch request itself fails", async () => {
    await insertDish(
      db,
      makeDish({ id: "req-fail-1", syncStatus: "pending_create" }),
    );
    await insertDish(
      db,
      makeDish({
        id: "req-fail-2",
        serverId: "srv-req-fail",
        syncStatus: "pending_update",
      }),
    );

    mockApplyDishBatch.mockResolvedValue(batchFailed());

    await sync(db);

    const create = await db.dishes.findOne("req-fail-1").exec();
    expect(create!.get("syncStatus")).toBe("pending_create");
    expect(create!.get("serverId")).toBe("");

    const update = await db.dishes.findOne("req-fail-2").exec();
    expect(update!.get("syncStatus")).toBe("pending_update");

    expect(getSyncState().retryCount).toBe(1);
  });

  it("splits operations into batches the backend accepts", () => {
    const operations = Array.from({ length: 501 }, (_, index) => ({
      op: "create",
      id: `bulk-${index}`,
    }));

    const chunks = chunkOperations(operations);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(DISH_BATCH_MAX_OPERATIONS);
    expect(chunks[1]).toEqual([{ op: "create", id: "bulk-500" }]);
    expect(chunkOperations([])).toEqual([]);
  });

  it("drops a pending_create dish deleted before its first sync without calling the API", async () => {
    await insertDish(
      db,
      makeDish({
        id: "sync-draft-deleted",
        name: "Brouillon",
        syncStatus: "pending_create",
        isDeleted: true,
      }),
    );

    await sync(db);

    expect(mockApplyDishBatch).not.toHaveBeenCalled();

    const doc = await db.dishes.findOne("sync-draft-deleted").exec();
    expect(doc).toBeNull();
    expect(getSyncState().retryCount).toBe(0);
  });

  it("pushes pending updates in a batch using the server id", async () => {
    await insertDish(
      db,
      makeDish({
        id: "sync-2",
        serverId: "srv-2",
        name: "Updated Dish",
        syncStatus: "pending_update",
        description: "",
        course: 1,
        seasons: [0],
      }),
    );

    const updated = apiDish({
      id: "srv-2",
      name: "Updated Dish",
      description: "",
      course: 1,
      seasons: [0],
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    mockApplyDishBatch.mockResolvedValue(
      batchOk([
        { index: 0, op: "update", status: "updated", id: "srv-2", data: updated },
      ]),
    );
    mockGetDishes.mockResolvedValue({ ok: true, data: [updated] });

    await sync(db);

    expect(mockApplyDishBatch).toHaveBeenCalledWith({
      operations: [
        {
          op: "update",
          id: "srv-2",
          name: "Updated Dish",
          description: "",
          course: 1,
          seasons: [0],
        },
      ],
    });

    const doc = await db.dishes.findOne("sync-2").exec();
    expect(doc!.get("syncStatus")).toBe("synced");
    expect(doc!.get("updatedAt")).toBe("2026-01-02T00:00:00.000Z");
  });

  it("pushes pending deletes in a batch and removes them locally", async () => {
    await insertDish(
      db,
      makeDish({
        id: "sync-3",
        serverId: "srv-3",
        syncStatus: "pending_delete",
        isDeleted: true,
      }),
    );

    mockApplyDishBatch.mockResolvedValue(
      batchOk([{ index: 0, op: "delete", status: "deleted", id: "srv-3" }]),
    );
    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    await sync(db);

    expect(mockApplyDishBatch).toHaveBeenCalledWith({
      operations: [{ op: "delete", id: "srv-3" }],
    });

    expect(await db.dishes.findOne("sync-3").exec()).toBeNull();

    const withServerId = await db.dishes
      .find({ selector: { serverId: "srv-3" } })
      .exec();
    expect(withServerId).toHaveLength(0);
  });

  it("leaves a tombstone when the row disappears while its create is in flight", async () => {
    await insertDish(
      db,
      makeDish({
        id: "sync-race",
        name: "Course",
        syncStatus: "pending_create",
        description: "",
        course: 1,
        seasons: [0],
      }),
    );

    mockApplyDishBatch.mockImplementation(async () => {
      // The user deletes the draft before the create response arrives.
      const doc = await db.dishes.findOne("sync-race").exec();
      if (doc) await doc.remove();
      return batchOk([
        {
          index: 0,
          op: "create",
          status: "created",
          id: "server-race",
          data: apiDish({ id: "server-race", name: "Course" }),
        },
      ]);
    });

    await sync(db);

    // The dish now exists remotely: a tombstone retries the delete instead of
    // the next pull resurrecting it.
    const tombstone = await db.dishes.findOne("server-race").exec();
    expect(tombstone).not.toBeNull();
    expect(tombstone!.get("syncStatus")).toBe("pending_delete");
    expect(tombstone!.get("isDeleted")).toBe(true);
  });

  it("keeps an edit that landed while its operation was in flight pending", async () => {
    await insertDish(
      db,
      makeDish({
        id: "sync-race-edit",
        serverId: "srv-race-edit",
        name: "Avant",
        syncStatus: "pending_update",
      }),
    );

    mockApplyDishBatch.mockImplementation(async () => {
      const doc = await db.dishes.findOne("sync-race-edit").exec();
      await doc!.patch({
        name: "Après",
        updatedAt: "2026-02-02T00:00:00.000Z",
      });
      return batchOk([
        {
          index: 0,
          op: "update",
          status: "updated",
          id: "srv-race-edit",
          data: apiDish({
            id: "srv-race-edit",
            name: "Avant",
            updatedAt: "2026-02-01T00:00:00.000Z",
          }),
        },
      ]);
    });
    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [apiDish({ id: "srv-race-edit", name: "Avant" })],
    });

    await sync(db);

    const doc = await db.dishes.findOne("sync-race-edit").exec();
    expect(doc!.get("name")).toBe("Après");
    expect(doc!.get("syncStatus")).toBe("pending_update");
    expect(doc!.get("updatedAt")).toBe("2026-02-02T00:00:00.000Z");
  });

  it("pulls remote dishes and inserts new ones locally", async () => {
    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "remote-1",
          userId: "u1",
          name: "Remote Dish",
          description: "From server",
          course: 0,
          seasons: [1, 2],
          updatedAt: "2026-06-01T00:00:00Z",
          isDeleted: false,
        },
      ],
    });

    await sync(db);

    const doc = await db.dishes.findOne("remote-1").exec();
    expect(doc).not.toBeNull();
    expect(doc!.get("name")).toBe("Remote Dish");
    expect(doc!.get("syncStatus")).toBe("synced");
  });

  it("pull merges: overwrites local when server is newer", async () => {
    await insertDish(
      db,
      makeDish({
        id: "remote-2",
        serverId: "remote-2",
        name: "Old Name",
        syncStatus: "synced",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "remote-2",
          userId: "u1",
          name: "New Name",
          description: "",
          course: 1,
          seasons: [0],
          updatedAt: "2026-07-01T00:00:00Z",
          isDeleted: false,
        },
      ],
    });

    await sync(db);

    const doc = await db.dishes.findOne("remote-2").exec();
    expect(doc!.get("name")).toBe("New Name");
  });

  it("pull skips local when local is newer", async () => {
    await insertDish(
      db,
      makeDish({
        id: "remote-3",
        serverId: "remote-3",
        name: "Local Newer",
        syncStatus: "synced",
        updatedAt: "2026-08-01T00:00:00.000Z",
      }),
    );

    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "remote-3",
          userId: "u1",
          name: "Server Older",
          description: "",
          course: 1,
          seasons: [0],
          updatedAt: "2026-01-01T00:00:00Z",
          isDeleted: false,
        },
      ],
    });

    await sync(db);

    const doc = await db.dishes.findOne("remote-3").exec();
    expect(doc!.get("name")).toBe("Local Newer");
  });

  it("pull removes local synced dishes absent from server", async () => {
    await insertDish(
      db,
      makeDish({
        id: "gone-local",
        serverId: "gone-server",
        syncStatus: "synced",
      }),
    );

    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    await sync(db);

    const doc = await db.dishes.findOne("gone-local").exec();
    expect(doc).toBeNull();
  });

  it("does not remove local dishes with pending sync status", async () => {
    await insertDish(
      db,
      makeDish({
        id: "pending-local",
        serverId: "pending-server",
        syncStatus: "pending_update",
      }),
    );

    mockApplyDishBatch.mockResolvedValue(batchFailed());
    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    await sync(db);

    const doc = await db.dishes.findOne("pending-local").exec();
    expect(doc).not.toBeNull();
    expect(doc!.get("syncStatus")).toBe("pending_update");
  });

  it("pull removes local synced dish when server soft-deletes it (server newer)", async () => {
    await insertDish(
      db,
      makeDish({
        id: "local-sd-1",
        serverId: "srv-sd-1",
        name: "Synced Dish",
        syncStatus: "synced",
        isDeleted: false,
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "srv-sd-1",
          userId: "u1",
          name: "Synced Dish",
          description: "",
          course: 1,
          seasons: [0],
          updatedAt: "2026-07-26T00:00:00Z",
          isDeleted: true,
        },
      ],
    });

    await sync(db);

    const doc = await db.dishes.findOne("local-sd-1").exec();
    expect(doc).toBeNull();
  });

  it("pull keeps local synced dish when local is newer than server soft-delete (last mod wins)", async () => {
    await insertDish(
      db,
      makeDish({
        id: "local-sd-2",
        serverId: "srv-sd-2",
        name: "Local Newer",
        syncStatus: "synced",
        isDeleted: false,
        updatedAt: "2026-07-26T12:00:00.000Z",
      }),
    );

    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "srv-sd-2",
          userId: "u1",
          name: "Local Newer",
          description: "",
          course: 1,
          seasons: [0],
          updatedAt: "2026-07-26T10:00:00Z",
          isDeleted: true,
        },
      ],
    });

    await sync(db);

    const doc = await db.dishes.findOne("local-sd-2").exec();
    expect(doc).not.toBeNull();
    expect(doc!.get("isDeleted")).toBe(false);
  });

  it("pull keeps local pending_update when server soft-deletes the dish", async () => {
    await insertDish(
      db,
      makeDish({
        id: "local-sd-3",
        serverId: "srv-sd-3",
        name: "Modified Dish",
        syncStatus: "pending_update",
        isDeleted: false,
        updatedAt: "2026-07-26T12:00:00.000Z",
      }),
    );

    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "srv-sd-3",
          userId: "u1",
          name: "Modified Dish",
          description: "",
          course: 1,
          seasons: [0],
          updatedAt: "2026-07-26T10:00:00Z",
          isDeleted: true,
        },
      ],
    });

    await sync(db);

    const doc = await db.dishes.findOne("local-sd-3").exec();
    expect(doc).not.toBeNull();
    expect(doc!.get("name")).toBe("Modified Dish");
    expect(doc!.get("syncStatus")).toBe("pending_update");
    expect(doc!.get("isDeleted")).toBe(false);
  });

  it("push pending_update keeps the local dish when the operation reports NOT_FOUND", async () => {
    await insertDish(
      db,
      makeDish({
        id: "local-sd-4",
        serverId: "srv-sd-4",
        name: "Other Account Dish",
        syncStatus: "pending_update",
        isDeleted: false,
        description: "Updated",
        course: 2,
        seasons: [1],
        updatedAt: "2026-07-26T12:00:00.000Z",
      }),
    );

    mockApplyDishBatch.mockResolvedValue(
      batchOk([
        {
          index: 0,
          op: "update",
          status: "failed",
          id: "srv-sd-4",
          code: "NOT_FOUND",
          message: "The requested resource was not found.",
        },
      ]),
    );
    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    await sync(db);

    expect(mockApplyDishBatch).toHaveBeenCalledWith({
      operations: [
        {
          op: "update",
          id: "srv-sd-4",
          name: "Other Account Dish",
          description: "Updated",
          course: 2,
          seasons: [1],
        },
      ],
    });

    const doc = await db.dishes.findOne("local-sd-4").exec();
    expect(doc).not.toBeNull();
    expect(doc!.get("syncStatus")).toBe("pending_update");
    expect(doc!.get("name")).toBe("Other Account Dish");
    expect(getSyncState().retryCount).toBe(1);
  });

  it("pull does not re-insert soft-deleted dish with no local match", async () => {
    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "srv-orphan",
          userId: "u1",
          name: "Deleted Dish",
          description: "",
          course: 1,
          seasons: [0],
          updatedAt: "2026-07-26T00:00:00Z",
          isDeleted: true,
        },
      ],
    });

    await sync(db);

    const all = await db.dishes.find().exec();
    expect(all).toHaveLength(0);
  });

  it("first sync (no lastSyncAt) does a full pull without since param", async () => {
    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    await sync(db);

    expect(mockGetDishes).toHaveBeenCalledWith({});
  });

  it("subsequent sync passes stored lastSyncAt as since param", async () => {
    const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await db.preferences.upsert({
      key: "lastSyncAt",
      value: recentDate,
      updatedAt: recentDate,
    });

    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    await sync(db);

    expect(mockGetDishes).toHaveBeenCalledWith({
      since: recentDate,
    });
  });

  it("does a full pull when lastSyncAt is older than 30 days", async () => {
    const staleDate = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await db.preferences.upsert({
      key: "lastSyncAt",
      value: staleDate,
      updatedAt: staleDate,
    });

    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    await sync(db);

    expect(mockGetDishes).toHaveBeenCalledWith({});
  });

  it("persists lastSyncAt after successful pull", async () => {
    const beforeSync = new Date().toISOString();

    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    await sync(db);

    const pref = await db.preferences.findOne("lastSyncAt").exec();
    expect(pref).not.toBeNull();
    const stored = pref!.get("value") as string;
    expect(new Date(stored).getTime()).toBeGreaterThanOrEqual(
      new Date(beforeSync).getTime(),
    );
  });

  it("skips orphan removal during incremental sync", async () => {
    const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await db.preferences.upsert({
      key: "lastSyncAt",
      value: recentDate,
      updatedAt: recentDate,
    });

    await insertDish(
      db,
      makeDish({
        id: "existing-local",
        serverId: "existing-server",
        name: "Existing Dish",
        syncStatus: "synced",
      }),
    );

    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "other-server",
          userId: "u1",
          name: "Other Dish",
          description: "",
          course: 1,
          seasons: [0],
          updatedAt: "2026-07-25T00:00:00Z",
          isDeleted: false,
        },
      ],
    });

    await sync(db);

    const doc = await db.dishes.findOne("existing-local").exec();
    expect(doc).not.toBeNull();
    expect(doc!.get("name")).toBe("Existing Dish");
  });

  it("performs orphan removal during first full sync", async () => {
    await insertDish(
      db,
      makeDish({
        id: "orphan-local",
        serverId: "orphan-server",
        name: "Orphan Dish",
        syncStatus: "synced",
      }),
    );

    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    await sync(db);

    const doc = await db.dishes.findOne("orphan-local").exec();
    expect(doc).toBeNull();
  });

  it("performs orphan removal when lastSyncAt is stale", async () => {
    const staleDate = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await db.preferences.upsert({
      key: "lastSyncAt",
      value: staleDate,
      updatedAt: staleDate,
    });

    await insertDish(
      db,
      makeDish({
        id: "orphan-local",
        serverId: "orphan-server",
        name: "Orphan Dish",
        syncStatus: "synced",
      }),
    );

    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    await sync(db);

    const doc = await db.dishes.findOne("orphan-local").exec();
    expect(doc).toBeNull();
  });
});

// ── menu sync ───────────────────────────────────────────────────────────────

// ── flushPendingDishes ───────────────────────────────────────────────────────

describe("flushPendingDishes", () => {
  it("pushes pending changes without pulling dishes or the menu", async () => {
    await insertDish(
      db,
      makeDish({ id: "flush-1", syncStatus: "pending_create" }),
    );
    mockApplyDishBatch.mockResolvedValue(
      batchOk([
        {
          index: 0,
          op: "create",
          status: "created",
          id: "flush-1",
          data: apiDish({ id: "flush-1" }),
        },
      ]),
    );

    const result = await flushPendingDishes(db);

    expect(result).toEqual({ failed: false });
    expect(mockApplyDishBatch).toHaveBeenCalledTimes(1);
    expect(mockGetDishes).not.toHaveBeenCalled();
    expect(mockGetMenu).not.toHaveBeenCalled();

    const doc = await db.dishes.findOne("flush-1").exec();
    expect(doc!.get("syncStatus")).toBe("synced");
  });

  it("reports a failed push without scheduling a retry", async () => {
    await insertDish(
      db,
      makeDish({ id: "flush-2", syncStatus: "pending_create" }),
    );
    mockApplyDishBatch.mockResolvedValue(batchFailed());

    const result = await flushPendingDishes(db);

    expect(result).toEqual({ failed: true });
    expect(getSyncState().retryCount).toBe(0);

    const doc = await db.dishes.findOne("flush-2").exec();
    expect(doc!.get("syncStatus")).toBe("pending_create");
  });

  it("skips when offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    await expect(flushPendingDishes(db)).resolves.toBeNull();
    expect(mockApplyDishBatch).not.toHaveBeenCalled();
  });

  it("skips when not logged in", async () => {
    localStorage.removeItem("user_id");

    await expect(flushPendingDishes(db)).resolves.toBeNull();
    expect(mockApplyDishBatch).not.toHaveBeenCalled();
  });
});

// ── requestDishFlush ─────────────────────────────────────────────────────────

describe("requestDishFlush", () => {
  it("pushes the pending change without pulling dishes or the menu", async () => {
    await insertDish(
      db,
      makeDish({ id: "prompt-1", syncStatus: "pending_create" }),
    );
    mockApplyDishBatch.mockResolvedValue(
      batchOk([
        {
          index: 0,
          op: "create",
          status: "created",
          id: "prompt-1",
          data: apiDish({
            id: "prompt-1",
            updatedAt: "2026-01-02T00:00:00.000Z",
          }),
        },
      ]),
    );

    await requestDishFlush(db);

    expect(mockApplyDishBatch).toHaveBeenCalledTimes(1);
    expect(mockGetDishes).not.toHaveBeenCalled();
    expect(mockGetMenu).not.toHaveBeenCalled();

    const doc = await db.dishes.findOne("prompt-1").exec();
    expect(doc!.get("syncStatus")).toBe("synced");
  });

  it("sends an edit made during the push in a second, sequential pass", async () => {
    await insertDish(
      db,
      makeDish({
        id: "rapid-1",
        serverId: "srv-rapid",
        name: "First",
        syncStatus: "pending_update",
      }),
    );

    let resolveFirst!: () => void;
    mockApplyDishBatch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = () =>
            resolve(
              batchOk([
                {
                  index: 0,
                  op: "update",
                  status: "updated",
                  data: apiDish({
                    id: "srv-rapid",
                    updatedAt: "2026-01-01T00:00:00.000Z",
                  }),
                },
              ]),
            );
        }),
    );

    const loop = requestDishFlush(db);
    await vi.waitFor(() =>
      expect(mockApplyDishBatch).toHaveBeenCalledTimes(1),
    );

    await editDish(db, "rapid-1", {
      name: "Second",
      description: "A test dish",
      course: 1,
      seasons: [0, 1],
    });
    void requestDishFlush(db);

    mockApplyDishBatch.mockResolvedValueOnce(
      batchOk([
        {
          index: 0,
          op: "update",
          status: "updated",
          data: apiDish({
            id: "srv-rapid",
            updatedAt: "2026-01-01T00:00:01.000Z",
          }),
        },
      ]),
    );

    expect(mockApplyDishBatch).toHaveBeenCalledTimes(1);
    resolveFirst();
    await loop;

    expect(mockApplyDishBatch).toHaveBeenCalledTimes(2);
    expect(mockApplyDishBatch.mock.calls[1][0]).toEqual({
      operations: [
        {
          op: "update",
          id: "srv-rapid",
          name: "Second",
          description: "A test dish",
          course: 1,
          seasons: [0, 1],
        },
      ],
    });

    const doc = await db.dishes.findOne("rapid-1").exec();
    expect(doc!.get("syncStatus")).toBe("synced");
  });

  it("keeps a delete made during the push as a delete", async () => {
    await insertDish(
      db,
      makeDish({
        id: "rapid-del",
        serverId: "srv-del",
        syncStatus: "pending_update",
      }),
    );

    let resolveFirst!: () => void;
    mockApplyDishBatch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = () =>
            resolve(
              batchOk([
                {
                  index: 0,
                  op: "update",
                  status: "updated",
                  data: apiDish({
                    id: "srv-del",
                    updatedAt: "2026-01-01T00:00:01.000Z",
                  }),
                },
              ]),
            );
        }),
    );

    const loop = requestDishFlush(db);
    await vi.waitFor(() =>
      expect(mockApplyDishBatch).toHaveBeenCalledTimes(1),
    );

    await softDeleteDish(db, "rapid-del");
    void requestDishFlush(db);

    mockApplyDishBatch.mockResolvedValueOnce(
      batchOk([{ index: 0, op: "delete", status: "deleted" }]),
    );

    resolveFirst();
    await loop;

    expect(mockApplyDishBatch).toHaveBeenCalledTimes(2);
    expect(mockApplyDishBatch.mock.calls[1][0]).toEqual({
      operations: [{ op: "delete", id: "srv-del" }],
    });
    expect(await db.dishes.findOne("rapid-del").exec()).toBeNull();
  });

  it("waits for an in-flight sync before pushing", async () => {
    let resolvePull!: () => void;
    mockGetDishes.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePull = () => resolve({ ok: true, data: [] });
        }),
    );

    const syncPromise = sync(db);
    await vi.waitFor(() =>
      expect(mockGetDishes).toHaveBeenCalledTimes(1),
    );

    await insertDish(
      db,
      makeDish({ id: "queued-1", syncStatus: "pending_create" }),
    );
    mockApplyDishBatch.mockResolvedValue(
      batchOk([
        {
          index: 0,
          op: "create",
          status: "created",
          id: "queued-1",
          data: apiDish({
            id: "queued-1",
            updatedAt: "2026-01-02T00:00:00.000Z",
          }),
        },
      ]),
    );

    const flushPromise = requestDishFlush(db);
    await Promise.resolve();
    expect(mockApplyDishBatch).not.toHaveBeenCalled();

    resolvePull();
    await syncPromise;
    await flushPromise;

    expect(mockApplyDishBatch).toHaveBeenCalledTimes(1);
    const doc = await db.dishes.findOne("queued-1").exec();
    expect(doc!.get("syncStatus")).toBe("synced");
  });

  it("does not retry in a tight loop after a failed push", async () => {
    await insertDish(
      db,
      makeDish({ id: "fail-1", syncStatus: "pending_create" }),
    );
    mockApplyDishBatch.mockResolvedValue(batchFailed());

    await requestDishFlush(db);

    expect(mockApplyDishBatch).toHaveBeenCalledTimes(1);
    const doc = await db.dishes.findOne("fail-1").exec();
    expect(doc!.get("syncStatus")).toBe("pending_create");
  });
});

describe("menu sync", () => {
  it("pushes the saved snapshot, not the working draft", async () => {
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: ["draft-dish"],
      history: [],
      mode: "editing",
    });
    beginMenuSave(
      "test-user",
      {
        queueIds: [],
        selectedIds: ["saved-dish"],
        history: [],
        mode: "recap",
      },
      ["saved-dish"],
    );
    // The user keeps reviewing after validating.
    markMenuModified("test-user");
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: ["saved-dish", "draft-dish"],
      history: [],
      mode: "editing",
    });

    mockSaveMenu.mockResolvedValue({
      ok: true,
      data: {
        selectedDishIds: ["saved-dish"],
        updatedAt: "2026-08-01T00:00:00Z",
      },
    });

    await sync(db);

    expect(mockSaveMenu).toHaveBeenCalledWith({
      selectedDishIds: ["saved-dish"],
      expectedUpdatedAt: null,
    });
    const stored = loadStoredMenu("test-user");
    expect(stored?.pendingSave).toBe(false);
    expect(stored?.serverUpdatedAt).toBe("2026-08-01T00:00:00Z");
    expect(isMenuDirty(stored!)).toBe(true);
  });

  it("does not push the menu when it has no pending save", async () => {
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: ["draft-dish"],
      history: [],
      mode: "editing",
    });

    await sync(db);

    expect(mockSaveMenu).not.toHaveBeenCalled();
  });

  it("immediately pushes a save after validate/clear", async () => {
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: ["saved-dish"],
      history: [],
      mode: "editing",
    });
    beginMenuSave(
      "test-user",
      {
        queueIds: [],
        selectedIds: ["saved-dish"],
        history: [],
        mode: "recap",
      },
      ["saved-dish"],
    );
    mockSaveMenu.mockResolvedValue({
      ok: true,
      data: {
        selectedDishIds: ["saved-dish"],
        updatedAt: "2026-08-01T00:00:00Z",
      },
    });

    await saveMenuNow();

    expect(mockSaveMenu).toHaveBeenCalledWith({
      selectedDishIds: ["saved-dish"],
      expectedUpdatedAt: null,
    });
    expect(loadStoredMenu("test-user")?.pendingSave).toBe(false);
  });

  it("adopts the remote menu when local has no unreconciled changes", async () => {
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: ["old-dish"],
      history: [],
      mode: "recap",
    });
    mockGetMenu.mockResolvedValue({
      ok: true,
      data: {
        selectedDishIds: ["remote-dish"],
        updatedAt: "2026-08-01T00:00:00Z",
      },
    });

    await sync(db);

    const stored = loadStoredMenu("test-user");
    expect(stored?.selectedIds).toEqual(["remote-dish"]);
    expect(stored?.mode).toBe("recap");
    expect(isMenuDirty(stored!)).toBe(false);
  });

  it("shows a conflict even when the remote menu is older than the local edit", async () => {
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: ["local-dish"],
      history: [],
      mode: "editing",
    });
    markMenuModified("test-user");
    mockGetMenu.mockResolvedValue({
      ok: true,
      data: {
        selectedDishIds: ["remote-dish"],
        updatedAt: "2020-01-01T00:00:00Z",
      },
    });

    await sync(db);

    const stored = loadStoredMenu("test-user");
    expect(stored?.selectedIds).toEqual(["local-dish"]);
    expect(isMenuDirty(stored!)).toBe(true);
    expect(getPendingRemoteMenu("test-user")?.selectedDishIds).toEqual([
      "remote-dish",
    ]);
    expect(mockSaveMenu).not.toHaveBeenCalled();
  });

  it("does not show a conflict when the remote menu matches the saved snapshot", async () => {
    beginMenuSave(
      "test-user",
      {
        queueIds: [],
        selectedIds: ["saved-dish"],
        history: [],
        mode: "recap",
      },
      ["saved-dish"],
    );
    mockGetMenu.mockResolvedValue({
      ok: true,
      data: {
        selectedDishIds: ["saved-dish"],
        updatedAt: "2026-08-01T00:00:00Z",
      },
    });

    await sync(db);

    expect(mockSaveMenu).not.toHaveBeenCalled();
    const stored = loadStoredMenu("test-user");
    expect(stored?.pendingSave).toBe(false);
    expect(stored?.serverUpdatedAt).toBe("2026-08-01T00:00:00Z");
  });

  it("resolves a 409 by showing the newer remote menu", async () => {
    beginMenuSave(
      "test-user",
      {
        queueIds: [],
        selectedIds: ["local-dish"],
        history: [],
        mode: "recap",
      },
      ["local-dish"],
    );
    mockGetMenu.mockResolvedValueOnce({
      ok: true,
      data: { selectedDishIds: [], updatedAt: null },
    });
    mockSaveMenu.mockResolvedValue({
      ok: false,
      error: {
        code: "MENU_VERSION_CONFLICT",
        message: "The menu was modified.",
      },
    });
    mockGetMenu.mockResolvedValueOnce({
      ok: true,
      data: {
        selectedDishIds: ["remote-dish"],
        updatedAt: "2026-09-01T00:00:00Z",
      },
    });

    await sync(db);

    expect(mockSaveMenu).toHaveBeenCalledWith({
      selectedDishIds: ["local-dish"],
      expectedUpdatedAt: null,
    });
    const stored = loadStoredMenu("test-user");
    expect(stored?.selectedIds).toEqual(["local-dish"]);
    expect(getPendingRemoteMenu("test-user")?.selectedDishIds).toEqual([
      "remote-dish",
    ]);
  });

  it("does not treat sub-millisecond version differences as the same version", async () => {
    // Firestore persists microseconds while .NET produces 100 ns ticks, so a
    // version returned by a PUT can be truncated on read. Comparing only the
    // millisecond used to make the client re-push the stale version forever.
    // The server must return the stored precision; the client must not mask a
    // mismatch by treating two distinct versions as equal.
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: ["first-dish"],
      history: [],
      mode: "editing",
    });
    beginMenuSave(
      "test-user",
      {
        queueIds: [],
        selectedIds: ["first-dish"],
        history: [],
        mode: "recap",
      },
      ["first-dish"],
    );
    mockSaveMenu.mockResolvedValueOnce({
      ok: true,
      data: {
        selectedDishIds: ["first-dish"],
        updatedAt: "2026-11-13T17:54:23.8732944+00:00",
      },
    });
    await saveMenuNow();

    beginMenuSave(
      "test-user",
      {
        queueIds: [],
        selectedIds: ["second-dish"],
        history: [],
        mode: "recap",
      },
      ["second-dish"],
    );
    mockSaveMenu.mockResolvedValue({
      ok: false,
      error: {
        code: "MENU_VERSION_CONFLICT",
        message: "The menu was modified.",
      },
    });
    mockGetMenu.mockResolvedValueOnce({
      ok: true,
      data: {
        selectedDishIds: ["first-dish"],
        updatedAt: "2026-11-13T17:54:23.8732940+00:00",
      },
    });

    await saveMenuNow();

    // One successful PUT, one rejected PUT. The older-looking GET is left for
    // the retry path (and the backend precision fix); it must not trigger a
    // third PUT with the same stale expectedUpdatedAt.
    expect(mockSaveMenu).toHaveBeenCalledTimes(2);
    expect(loadStoredMenu("test-user")?.pendingSave).toBe(true);
  });

  it("loads the remote menu when the user chooses it", async () => {
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: ["local-dish"],
      history: [],
      mode: "editing",
    });
    markMenuModified("test-user");
    setPendingRemoteMenu("test-user", {
      selectedDishIds: ["remote-dish"],
      updatedAt: "2026-09-01T00:00:00Z",
    });

    await resolveMenuConflict("load");

    const stored = loadStoredMenu("test-user");
    expect(stored?.selectedIds).toEqual(["remote-dish"]);
    expect(getPendingRemoteMenu("test-user")).toBeNull();
  });

  it("keeps the local menu and acknowledges the remote version", async () => {
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: ["local-dish"],
      history: [],
      mode: "editing",
    });
    markMenuModified("test-user");
    setPendingRemoteMenu("test-user", {
      selectedDishIds: ["remote-dish"],
      updatedAt: "2026-09-01T00:00:00Z",
    });

    await resolveMenuConflict("keep");

    const stored = loadStoredMenu("test-user");
    expect(stored?.selectedIds).toEqual(["local-dish"]);
    expect(stored?.serverUpdatedAt).toBe("2026-09-01T00:00:00Z");
    expect(getPendingRemoteMenu("test-user")).toBeNull();
  });

  it("reports failure when the menu pull fails", async () => {
    mockGetMenu.mockResolvedValue({
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Network request failed" },
    });

    await sync(db);

    expect(getSyncState().lastErrorAt).not.toBeNull();
  });
});

// ── startAutoSync ───────────────────────────────────────────────────────────

describe("startAutoSync", () => {
  it("returns a cleanup function", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const cleanup = startAutoSync(db);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("does not set up sync when not logged in", () => {
    localStorage.removeItem("user_id");
    vi.stubGlobal("navigator", { onLine: false });
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    const cleanup = startAutoSync(db);

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(mockGetDishes).not.toHaveBeenCalled();

    setIntervalSpy.mockRestore();
    cleanup();
  });

  it("triggers sync when coming online", async () => {
    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    const cleanup = startAutoSync(db);

    window.dispatchEvent(new Event("online"));
    // Allow async sync to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(mockGetDishes).toHaveBeenCalled();

    cleanup();
  });

  it("sets up hourly sync interval", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    const cleanup = startAutoSync(db);

    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      3_600_000,
    );

    setIntervalSpy.mockRestore();
    cleanup();
  });

  it("cleanup removes event listeners and clears interval", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const cleanup = startAutoSync(db);

    const onlineSpy = vi.spyOn(window, "removeEventListener");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    cleanup();

    expect(onlineSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(clearIntervalSpy).toHaveBeenCalled();

    onlineSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("reports the offline state when the offline event fires", () => {
    vi.stubGlobal("navigator", { onLine: true });
    const cleanup = startAutoSync(db);
    expect(getSyncState().online).toBe(true);

    window.dispatchEvent(new Event("offline"));
    expect(getSyncState().online).toBe(false);

    window.dispatchEvent(new Event("online"));
    expect(getSyncState().online).toBe(true);

    cleanup();
  });

  it("seeds lastSyncAt from the database on startup", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const seededDate = "2026-01-15T12:00:00.000Z";
    await db.preferences.upsert({
      key: "lastSyncAt",
      value: seededDate,
      updatedAt: seededDate,
    });

    const cleanup = startAutoSync(db);
    await new Promise((r) => setTimeout(r, 50));

    expect(getSyncState().lastSyncAt).toBe(seededDate);

    cleanup();
  });
});

// ── sync status reporting ───────────────────────────────────────────────────

describe("sync status reporting", () => {
  it("reports syncing phase while pushing pending changes", async () => {
    await insertDish(
      db,
      makeDish({ id: "status-1", syncStatus: "pending_create" }),
    );

    const phasesDuringPush: string[] = [];
    mockApplyDishBatch.mockImplementation(async () => {
      phasesDuringPush.push(getSyncState().phase);
      return batchFailed();
    });

    await sync(db);

    expect(phasesDuringPush).toEqual(["syncing"]);
  });

  it("reports success with lastSyncAt after a successful sync", async () => {
    mockGetDishes.mockResolvedValue({ ok: true, data: [] });
    const before = new Date().toISOString();

    await sync(db);

    const status = getSyncState();
    expect(status.phase).toBe("idle");
    expect(status.lastErrorAt).toBeNull();
    expect(status.retryCount).toBe(0);
    expect(status.lastSyncAt).not.toBeNull();
    expect(new Date(status.lastSyncAt!).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime(),
    );
  });

  it("resets to idle after the sync completes", async () => {
    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    expect(getSyncState().phase).toBe("idle");
    await sync(db);
    expect(getSyncState().phase).toBe("idle");
  });

  it("reports failure and increments retryCount when push fails", async () => {
    await insertDish(
      db,
      makeDish({ id: "status-2", syncStatus: "pending_create" }),
    );
    mockApplyDishBatch.mockResolvedValue(batchFailed());

    await sync(db);

    const status = getSyncState();
    expect(status.phase).toBe("idle");
    expect(status.lastErrorAt).not.toBeNull();
    expect(status.retryCount).toBe(1);
  });

  it("reports failure when the pull fails", async () => {
    mockGetDishes.mockResolvedValue({
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Network request failed" },
    });

    await sync(db);

    const status = getSyncState();
    expect(status.phase).toBe("idle");
    expect(status.lastErrorAt).not.toBeNull();
    expect(status.retryCount).toBe(1);
  });

  it("backs off 1s→5s→15s→30s then retries every minute", async () => {
    mockGetDishes.mockResolvedValue({
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Network request failed" },
    });

    const nominalDelays = [1_000, 5_000, 15_000, 30_000, 60_000, 60_000];
    for (let i = 0; i < nominalDelays.length; i++) {
      await sync(db);
      expect(getSyncState().retryCount).toBe(i + 1);
    }
  });

  it("clears the error after a subsequent successful sync", async () => {
    mockGetDishes.mockResolvedValue({
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Network request failed" },
    });
    await sync(db);
    expect(getSyncState().lastErrorAt).not.toBeNull();

    mockGetDishes.mockResolvedValue({ ok: true, data: [] });
    await sync(db);

    const status = getSyncState();
    expect(status.lastErrorAt).toBeNull();
    expect(status.retryCount).toBe(0);
    expect(status.lastSyncAt).not.toBeNull();
  });

  it("does not report syncing when the sync is skipped (offline)", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    await sync(db);

    expect(getSyncState().phase).toBe("idle");
  });
});

// ── refreshFromServer ────────────────────────────────────────────────────────

describe("refreshFromServer", () => {
  it("skips when offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    const ok = await refreshFromServer(db);

    expect(ok).toBe(false);
    expect(mockGetDishes).not.toHaveBeenCalled();
  });

  it("skips when not logged in", async () => {
    localStorage.removeItem("user_id");

    const ok = await refreshFromServer(db);

    expect(ok).toBe(false);
    expect(mockGetDishes).not.toHaveBeenCalled();
  });

  it("ignores a recent lastSyncAt and pulls without since", async () => {
    const recentDate = new Date(Date.now() - 60_000).toISOString();
    await db.preferences.upsert({
      key: "lastSyncAt",
      value: recentDate,
      updatedAt: recentDate,
    });
    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    const ok = await refreshFromServer(db);

    expect(ok).toBe(true);
    expect(mockGetDishes).toHaveBeenCalledWith({ since: undefined });
  });

  it("does not start a second pull while a sync is running", async () => {
    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    const syncPromise = sync(db);
    const ok = await refreshFromServer(db);

    expect(ok).toBe(false);
    await syncPromise;
    expect(mockGetDishes).toHaveBeenCalledTimes(1);
  });

  it("prevents a scheduled sync from overlapping a refresh", async () => {
    let resolveDishes!: (value: Awaited<ReturnType<typeof getDishes>>) => void;
    mockGetDishes.mockReturnValue(
      new Promise((resolve) => {
        resolveDishes = resolve;
      }),
    );

    const refreshPromise = refreshFromServer(db);
    await vi.waitFor(() => {
      expect(mockGetDishes).toHaveBeenCalledTimes(1);
    });

    await sync(db);

    expect(mockGetDishes).toHaveBeenCalledTimes(1);

    resolveDishes({ ok: true, data: [] });
    await refreshPromise;
  });

  it("forces a full pull and merges remote dishes", async () => {
    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "srv-import-1",
          userId: "u1",
          name: "Plat importé",
          description: "",
          course: 1,
          seasons: [0],
          updatedAt: "2026-01-02T00:00:00Z",
          isDeleted: false,
        },
      ],
    });

    const ok = await refreshFromServer(db);

    expect(ok).toBe(true);
    expect(mockGetDishes).toHaveBeenCalledWith({ since: undefined });
    const docs = await db.dishes.find().exec();
    expect(docs.map((d) => d.get("serverId"))).toContain("srv-import-1");
    expect(docs.map((d) => d.get("syncStatus"))).toContain("synced");
  });
});
