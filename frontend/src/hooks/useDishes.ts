import { useDatabase } from "../db/DatabaseContext";
import type { DishDocType } from "../db/schemas/dishes";
import type { ValidatedDishImportItem } from "../types/dish";
import {
  insertDish,
  insertManyDishes,
  buildPendingDishes,
  editDish as repoEditDish,
  softDeleteDish,
  observeDishes,
} from "../repositories/dishRepository";
import { requestDishFlush } from "../services/syncService";
import { useMemo, useState, useEffect } from "react";
import type { Observable } from "rxjs";

function useObservableQuery<T>(
  observable$: Observable<T[]> | undefined,
  fallback: T[]
): { value: T[]; isLoaded: boolean } {
  const [value, setValue] = useState<T[]>(fallback);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!observable$) return;
    const sub = observable$.subscribe((next) => {
      setValue(next);
      setIsLoaded(true);
    });
    return () => sub.unsubscribe();
  }, [observable$]);

  return { value, isLoaded };
}

export function useDishes() {
  const { db } = useDatabase();

  const dishes$ = useMemo(() => {
    if (!db) return undefined;
    return observeDishes(db);
  }, [db]);

  const { value: dishes, isLoaded } = useObservableQuery(dishes$, []);

  async function addDish(dish: DishDocType): Promise<void> {
    if (!db) throw new Error("Database not ready");
    await insertDish(db, dish);
    void requestDishFlush(db);
  }

  /**
   * Store imported dishes locally as unsynced creations.
   * Used when the backend is unreachable so the sync engine can push them later.
   */
  async function importLocalDishes(
    items: ValidatedDishImportItem[],
  ): Promise<void> {
    if (!db) throw new Error("Database not ready");
    await insertManyDishes(db, buildPendingDishes(items));
    void requestDishFlush(db);
  }

  async function editDish(
    id: string,
    fields: { name: string; description: string; course: number; seasons: number[] }
  ): Promise<void> {
    if (!db) throw new Error("Database not ready");
    await repoEditDish(db, id, fields);
    void requestDishFlush(db);
  }

  async function removeDish(id: string): Promise<void> {
    if (!db) throw new Error("Database not ready");
    await softDeleteDish(db, id);
    void requestDishFlush(db);
  }

  return {
    dishes,
    isLoaded,
    addDish,
    importLocalDishes,
    editDish,
    removeDish,
  };
}
