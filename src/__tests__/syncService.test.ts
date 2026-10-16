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
import { insertDish } from "../repositories/dishRepository";
import { loadStoredMenu, storeMenu } from "../services/menuStorage";

addRxPlugin(RxDBDevModePlugin);

// ── Mock dishService ────────────────────────────────────────────────────────

vi.mock("../services/dishService", () => ({
  getDishes: vi.fn(),
  createDish: vi.fn(),
  updateDish: vi.fn(),
  deleteDish: vi.fn(),
}));

vi.mock("../services/menuService", () => ({
  getMenu: vi.fn(),
  saveMenu: vi.fn(),
}));

import {
  getDishes,
  createDish,
  updateDish,
  deleteDish,
} from "../services/dishService";
import { getMenu, saveMenu } from "../services/menuService";
import {
  sync,
  startAutoSync,
  refreshFromServer,
  _resetSyncState,
} from "../services/syncService";
import { getSyncState } from "../services/syncStatusStore";

const mockGetDishes = vi.mocked(getDishes);
const mockCreateDish = vi.mocked(createDish);
const mockUpdateDish = vi.mocked(updateDish);
const mockDeleteDish = vi.mocked(deleteDish);
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

beforeAll(async () => {
  const rawStorage = getRxStorageDexie();
  const validatedStorage = wrappedValidateAjvStorage({ storage: rawStorage });

  db = (await createRxDatabase<DatabaseCollections>({
    name: "test-sync-" + crypto.randomUUID(),
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
  localStorage.clear();
  localStorage.setItem("user_id", "test-user");
  mockGetDishes.mockResolvedValue({ ok: true, data: [] });
  mockGetMenu.mockResolvedValue({
    ok: true,
    data: { selectedDishIds: [], mode: "editing", updatedAt: null },
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

  it("pushes pending_create dishes to the API", async () => {
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

    mockCreateDish.mockResolvedValue({
      ok: true,
      data: {
        id: "server-1",
        userId: "u1",
        name: "Tarte",
        description: "",
        course: 2,
        seasons: [2],
        updatedAt: "2026-01-01T00:00:00Z",
        isDeleted: false,
      },
    });
    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "server-1",
          userId: "u1",
          name: "Tarte",
          description: "",
          course: 2,
          seasons: [2],
          updatedAt: "2026-01-01T00:00:00Z",
          isDeleted: false,
        },
      ],
    });

    await sync(db);

    expect(mockCreateDish).toHaveBeenCalledWith({
      id: "sync-1",
      name: "Tarte",
      description: "",
      course: 2,
      seasons: [2],
    });

    const doc = await db.dishes.findOne("sync-1").exec();
    expect(doc!.get("syncStatus")).toBe("synced");
    expect(doc!.get("serverId")).toBe("server-1");
  });

  it("pushes pending_update dishes to the API", async () => {
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

    mockUpdateDish.mockResolvedValue({
      ok: true,
      data: {
        id: "srv-2",
        userId: "u1",
        name: "Updated Dish",
        description: "",
        course: 1,
        seasons: [0],
        updatedAt: "2026-01-01T00:00:00Z",
        isDeleted: false,
      },
    });
    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "srv-2",
          userId: "u1",
          name: "Updated Dish",
          description: "",
          course: 1,
          seasons: [0],
          updatedAt: "2026-01-01T00:00:00Z",
          isDeleted: false,
        },
      ],
    });

    await sync(db);

    expect(mockUpdateDish).toHaveBeenCalledWith("srv-2", {
      name: "Updated Dish",
      description: "",
      course: 1,
      seasons: [0],
    });

    const doc = await db.dishes.findOne("sync-2").exec();
    expect(doc!.get("syncStatus")).toBe("synced");
  });

  it("pushes pending_delete dishes and removes them locally", async () => {
    await insertDish(
      db,
      makeDish({
        id: "sync-3",
        serverId: "srv-3",
        syncStatus: "pending_delete",
        isDeleted: true,
      }),
    );

    mockDeleteDish.mockResolvedValue({ ok: true, data: undefined });
    mockGetDishes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "srv-3",
          userId: "u1",
          name: "Deleted Dish",
          description: "",
          course: 1,
          seasons: [0],
          updatedAt: "2026-01-01T00:00:00Z",
          isDeleted: true,
        },
      ],
    });

    await sync(db);

    expect(mockDeleteDish).toHaveBeenCalledWith("srv-3");

    const doc = await db.dishes.findOne("sync-3").exec();
    expect(doc).toBeNull();

    const reInserted = await db.dishes
      .find({ selector: { serverId: "srv-3" } })
      .exec();
    expect(reInserted).toHaveLength(0);
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

    mockUpdateDish.mockResolvedValue({
      ok: false,
      error: { code: "SERVER_ERROR", message: "fail" },
    });
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

  it("push pending_update keeps the local dish when the server returns 404", async () => {
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

    mockUpdateDish.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "Dish not found" },
    });
    mockGetDishes.mockResolvedValue({ ok: true, data: [] });

    await sync(db);

    expect(mockUpdateDish).toHaveBeenCalledWith("srv-sd-4", {
      name: "Other Account Dish",
      description: "Updated",
      course: 2,
      seasons: [1],
    });
    expect(mockCreateDish).not.toHaveBeenCalled();

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

describe("menu sync", () => {
  it("pushes the menu when it has pending changes", async () => {
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: ["dish-a", "dish-b"],
      history: [],
      mode: "recap",
    });

    mockSaveMenu.mockResolvedValue({
      ok: true,
      data: {
        selectedDishIds: ["dish-a", "dish-b"],
        mode: "recap",
        updatedAt: "2026-08-01T00:00:00Z",
      },
    });

    await sync(db);

    expect(mockSaveMenu).toHaveBeenCalledWith({
      selectedDishIds: ["dish-a", "dish-b"],
      mode: "recap",
    });
    const stored = loadStoredMenu("test-user");
    expect(stored?.syncStatus).toBe("synced");
    expect(stored?.updatedAt).toBe("2026-08-01T00:00:00Z");
  });

  it("does not push the menu when it is already synced", async () => {
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: [],
      history: [],
      mode: "editing",
    });

    await sync(db);

    expect(mockSaveMenu).not.toHaveBeenCalled();
  });

  it("adopts the remote menu when local is clean and the server is newer", async () => {
    mockGetMenu.mockResolvedValue({
      ok: true,
      data: {
        selectedDishIds: ["remote-dish"],
        mode: "recap",
        updatedAt: "2026-08-01T00:00:00Z",
      },
    });

    await sync(db);

    const stored = loadStoredMenu("test-user");
    expect(stored?.selectedIds).toEqual(["remote-dish"]);
    expect(stored?.mode).toBe("recap");
    expect(stored?.syncStatus).toBe("synced");
  });

  it("keeps local pending changes over the remote menu", async () => {
    storeMenu("test-user", {
      queueIds: [],
      selectedIds: ["local-dish"],
      history: [],
      mode: "editing",
    });
    mockSaveMenu.mockResolvedValue({
      ok: false,
      error: { code: "HTTP_500", message: "fail" },
    });
    mockGetMenu.mockResolvedValue({
      ok: true,
      data: {
        selectedDishIds: ["remote-dish"],
        mode: "recap",
        updatedAt: "2030-01-01T00:00:00Z",
      },
    });

    await sync(db);

    const stored = loadStoredMenu("test-user");
    expect(stored?.selectedIds).toEqual(["local-dish"]);
    expect(stored?.syncStatus).toBe("pending_update");
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
    mockCreateDish.mockImplementation(async () => {
      phasesDuringPush.push(getSyncState().phase);
      return {
        ok: false,
        error: { code: "HTTP_500", message: "fail" },
      };
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
    mockCreateDish.mockResolvedValue({
      ok: false,
      error: { code: "HTTP_500", message: "fail" },
    });

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
