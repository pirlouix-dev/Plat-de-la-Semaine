import type { AppDatabase } from "../db/DatabaseContext";
import type { DishDocType } from "../db/schemas/dishes";
import type { ValidatedDishImportItem } from "../types/dish";

/**
 * Turn validated import entries into locally-created dish documents that the
 * sync engine will push to the backend on the next run.
 */
export function buildPendingDishes(
  items: ValidatedDishImportItem[],
  now: string = new Date().toISOString()
): DishDocType[] {
  return items.map((item) => ({
    id: crypto.randomUUID(),
    serverId: "",
    name: item.name,
    description: item.description,
    course: item.course,
    seasons: item.seasons,
    updatedAt: now,
    isDeleted: false,
    syncStatus: "pending_create",
  }));
}

export async function insertDish(
  db: AppDatabase,
  dish: DishDocType
): Promise<void> {
  await db.dishes.insert(dish);
}

export async function insertManyDishes(
  db: AppDatabase,
  dishes: DishDocType[]
): Promise<void> {
  if (dishes.length === 0) return;
  await db.dishes.bulkInsert(dishes);
}

export async function updateDish(
  db: AppDatabase,
  id: string,
  patch: Partial<Omit<DishDocType, "id">>
): Promise<void> {
  const doc = await db.dishes.findOne(id).exec();
  if (!doc) {
    throw new Error(`Dish not found: ${id}`);
  }
  await doc.patch(patch);
}

export async function upsertDish(
  db: AppDatabase,
  dish: DishDocType
): Promise<void> {
  await db.dishes.upsert(dish);
}

export async function softDeleteDish(
  db: AppDatabase,
  id: string
): Promise<void> {
  const doc = await db.dishes.findOne(id).exec();
  if (!doc) {
    throw new Error(`Dish not found: ${id}`);
  }
  // A creation that never reached the server cannot be deleted remotely:
  // drop it locally so the sync engine never POSTs it.
  if (doc.get("syncStatus") === "pending_create" && !doc.get("serverId")) {
    await doc.remove();
    return;
  }

  await doc.patch({
    isDeleted: true,
    syncStatus: "pending_delete",
    updatedAt: new Date().toISOString(),
  });
}

export async function removeDish(
  db: AppDatabase,
  id: string
): Promise<void> {
  const doc = await db.dishes.findOne(id).exec();
  if (doc) {
    await doc.remove();
  }
}

export async function getDishById(
  db: AppDatabase,
  id: string
): Promise<DishDocType | null> {
  const doc = await db.dishes.findOne(id).exec();
  return doc ? (doc.toJSON() as DishDocType) : null;
}

export async function getAllDishes(
  db: AppDatabase
): Promise<DishDocType[]> {
  const docs = await db.dishes.find().exec();
  return docs.map((doc) => doc.toJSON() as DishDocType);
}

export async function getPendingDishes(
  db: AppDatabase
): Promise<DishDocType[]> {
  const docs = await db.dishes
    .find({
      selector: {
        syncStatus: { $ne: "synced" },
      },
    })
    .exec();
  return docs.map((doc) => doc.toJSON() as DishDocType);
}

export function observeDishes(db: AppDatabase) {
  return db.dishes
    .find({
      selector: { isDeleted: false },
      sort: [{ name: "asc" }],
    })
    .$;
}

export function observeDishById(db: AppDatabase, id: string) {
  return db.dishes.findOne(id).$;
}

export async function editDish(
  db: AppDatabase,
  id: string,
  fields: { name: string; description: string; course: number; seasons: number[] }
): Promise<void> {
  const doc = await db.dishes.findOne(id).exec();
  if (!doc) {
    throw new Error(`Dish not found: ${id}`);
  }
  const syncStatus = doc.get("syncStatus");
  const newSyncStatus: DishDocType["syncStatus"] =
    syncStatus === "pending_create" ? "pending_create" : "pending_update";
  await doc.patch({
    ...fields,
    updatedAt: new Date().toISOString(),
    syncStatus: newSyncStatus,
  });
}
