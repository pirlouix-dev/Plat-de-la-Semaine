import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { addRxPlugin, createRxDatabase } from "rxdb/plugins/core";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { dishesSchema, type DishDocType } from "../db/schemas/dishes";
import { preferencesSchema } from "../db/schemas/preferences";
import type { DatabaseCollections } from "../db/collections";
import type { AppDatabase } from "../db/DatabaseContext";
import { hashFunction } from "../db/hashFunction";
import {
  insertDish,
  insertManyDishes,
  buildPendingDishes,
  updateDish,
  upsertDish,
  softDeleteDish,
  removeDish,
  getDishById,
  getAllDishes,
  getPendingDishes,
  editDish,
} from "../repositories/dishRepository";

addRxPlugin(RxDBDevModePlugin);

// ── Test database setup ─────────────────────────────────────────────────────

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
    name: "test-repo-" + crypto.randomUUID(),
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
});

// ── insertDish ──────────────────────────────────────────────────────────────

describe("insertDish", () => {
  it("inserts a dish into the database", async () => {
    const dish = makeDish({ id: "ins-1", name: "Pizza" });
    await insertDish(db, dish);

    const result = await getDishById(db, "ins-1");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Pizza");
  });

  it("throws on duplicate primary key", async () => {
    const dish = makeDish({ id: "dup-1" });
    await insertDish(db, dish);
    await expect(insertDish(db, dish)).rejects.toThrow();
  });
});

// ── getDishById ─────────────────────────────────────────────────────────────

describe("getDishById", () => {
  it("returns null for non-existent id", async () => {
    const result = await getDishById(db, "nonexistent");
    expect(result).toBeNull();
  });

  it("returns the full dish document as plain object", async () => {
    const dish = makeDish({ id: "get-1", name: "Risotto" });
    await insertDish(db, dish);

    const result = await getDishById(db, "get-1");
    expect(result).toEqual(
      expect.objectContaining({ id: "get-1", name: "Risotto" })
    );
  });
});

// ── getAllDishes ────────────────────────────────────────────────────────────

describe("getAllDishes", () => {
  it("returns empty array when no dishes", async () => {
    const result = await getAllDishes(db);
    expect(result).toEqual([]);
  });

  it("returns all dishes", async () => {
    await insertDish(db, makeDish({ id: "all-1", name: "A" }));
    await insertDish(db, makeDish({ id: "all-2", name: "B" }));

    const result = await getAllDishes(db);
    expect(result).toHaveLength(2);
  });
});

// ── updateDish ──────────────────────────────────────────────────────────────

describe("updateDish", () => {
  it("patches fields on an existing dish", async () => {
    await insertDish(db, makeDish({ id: "upd-1", name: "Old" }));
    await updateDish(db, "upd-1", { name: "New" });

    const result = await getDishById(db, "upd-1");
    expect(result!.name).toBe("New");
  });

  it("throws for non-existent id", async () => {
    await expect(
      updateDish(db, "missing", { name: "X" })
    ).rejects.toThrow("Dish not found");
  });
});

// ── editDish ────────────────────────────────────────────────────────────────

describe("editDish", () => {
  it("sets syncStatus to pending_update when currently synced", async () => {
    await insertDish(
      db,
      makeDish({ id: "ed-1", syncStatus: "synced", name: "Before" })
    );
    await editDish(db, "ed-1", {
      name: "After",
      description: "desc",
      course: 2,
      seasons: [3],
    });

    const result = await getDishById(db, "ed-1");
    expect(result!.name).toBe("After");
    expect(result!.syncStatus).toBe("pending_update");
  });

  it("keeps syncStatus as pending_create when already pending_create", async () => {
    await insertDish(
      db,
      makeDish({
        id: "ed-2",
        syncStatus: "pending_create",
        name: "Draft",
      })
    );
    await editDish(db, "ed-2", {
      name: "Draft Updated",
      description: "",
      course: 1,
      seasons: [0],
    });

    const result = await getDishById(db, "ed-2");
    expect(result!.syncStatus).toBe("pending_create");
  });

  it("throws for non-existent id", async () => {
    await expect(
      editDish(db, "missing", {
        name: "X",
        description: "",
        course: 1,
        seasons: [],
      })
    ).rejects.toThrow("Dish not found");
  });
});

// ── softDeleteDish ──────────────────────────────────────────────────────────

describe("softDeleteDish", () => {
  it("sets isDeleted and syncStatus to pending_delete for synced dish", async () => {
    await insertDish(
      db,
      makeDish({ id: "sd-1", syncStatus: "synced", isDeleted: false })
    );
    await softDeleteDish(db, "sd-1");

    const result = await getDishById(db, "sd-1");
    expect(result!.isDeleted).toBe(true);
    expect(result!.syncStatus).toBe("pending_delete");
  });

  it("removes a never-synced creation locally instead of queueing a delete", async () => {
    await insertDish(
      db,
      makeDish({
        id: "sd-2",
        syncStatus: "pending_create",
        isDeleted: false,
      })
    );
    await softDeleteDish(db, "sd-2");

    const result = await getDishById(db, "sd-2");
    expect(result).toBeNull();
  });

  it("queues a remote delete when a pending_create dish already has a serverId", async () => {
    await insertDish(
      db,
      makeDish({
        id: "sd-4",
        serverId: "srv-4",
        syncStatus: "pending_create",
        isDeleted: false,
      })
    );
    await softDeleteDish(db, "sd-4");

    const result = await getDishById(db, "sd-4");
    expect(result!.isDeleted).toBe(true);
    expect(result!.syncStatus).toBe("pending_delete");
  });

  it("sets syncStatus to pending_delete for pending_update dish", async () => {
    await insertDish(
      db,
      makeDish({
        id: "sd-3",
        syncStatus: "pending_update",
        isDeleted: false,
      })
    );
    await softDeleteDish(db, "sd-3");

    const result = await getDishById(db, "sd-3");
    expect(result!.isDeleted).toBe(true);
    expect(result!.syncStatus).toBe("pending_delete");
  });

  it("throws for non-existent id", async () => {
    await expect(softDeleteDish(db, "missing")).rejects.toThrow(
      "Dish not found"
    );
  });
});

// ── upsertDish ──────────────────────────────────────────────────────────────

describe("upsertDish", () => {
  it("inserts a new dish", async () => {
    const dish = makeDish({ id: "up-1", name: "New" });
    await upsertDish(db, dish);

    const result = await getDishById(db, "up-1");
    expect(result!.name).toBe("New");
  });

  it("replaces an existing dish", async () => {
    await insertDish(db, makeDish({ id: "up-2", name: "Old" }));
    await upsertDish(db, makeDish({ id: "up-2", name: "New" }));

    const result = await getDishById(db, "up-2");
    expect(result!.name).toBe("New");
  });
});

// ── removeDish ──────────────────────────────────────────────────────────────

describe("removeDish", () => {
  it("removes a dish from the database", async () => {
    await insertDish(db, makeDish({ id: "rm-1" }));
    await removeDish(db, "rm-1");

    const result = await getDishById(db, "rm-1");
    expect(result).toBeNull();
  });

  it("does not throw for non-existent id", async () => {
    await expect(removeDish(db, "missing")).resolves.toBeUndefined();
  });
});

// ── getPendingDishes ────────────────────────────────────────────────────────

describe("getPendingDishes", () => {
  it("returns only non-synced dishes", async () => {
    await insertDish(
      db,
      makeDish({ id: "pend-1", syncStatus: "synced" })
    );
    await insertDish(
      db,
      makeDish({ id: "pend-2", syncStatus: "pending_create" })
    );
    await insertDish(
      db,
      makeDish({ id: "pend-3", syncStatus: "pending_update" })
    );

    const pending = await getPendingDishes(db);
    expect(pending).toHaveLength(2);
    expect(pending.map((d) => d.id).sort()).toEqual(["pend-2", "pend-3"]);
  });

  it("returns empty array when all dishes are synced", async () => {
    await insertDish(
      db,
      makeDish({ id: "pend-4", syncStatus: "synced" })
    );

    const pending = await getPendingDishes(db);
    expect(pending).toEqual([]);
  });
});

// ── buildPendingDishes ──────────────────────────────────────────────────────

describe("buildPendingDishes", () => {
  it("maps import items to unsynced local documents", () => {
    const now = "2026-03-01T10:00:00.000Z";
    const result = buildPendingDishes(
      [
        {
          name: "Ratatouille",
          description: "Légumes",
          course: 1,
          seasons: [1, 2],
        },
      ],
      now,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "Ratatouille",
      description: "Légumes",
      course: 1,
      seasons: [1, 2],
      serverId: "",
      updatedAt: now,
      isDeleted: false,
      syncStatus: "pending_create",
    });
    expect(result[0].id).toBeTruthy();
  });

  it("returns an empty array for no items", () => {
    expect(buildPendingDishes([])).toEqual([]);
  });
});

// ── insertManyDishes ────────────────────────────────────────────────────────

describe("insertManyDishes", () => {
  it("inserts all dishes in one call", async () => {
    await insertManyDishes(db, [
      makeDish({ id: "many-1", name: "A", syncStatus: "pending_create" }),
      makeDish({ id: "many-2", name: "B", syncStatus: "pending_create" }),
    ]);

    const all = await getAllDishes(db);
    expect(all).toHaveLength(2);
  });

  it("is a no-op for an empty array", async () => {
    await expect(insertManyDishes(db, [])).resolves.toBeUndefined();
    expect(await getAllDishes(db)).toEqual([]);
  });
});

