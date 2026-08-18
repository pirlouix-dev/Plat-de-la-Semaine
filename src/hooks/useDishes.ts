import { useDatabase } from "../db/DatabaseContext";
import type { DishDocType } from "../db/schemas/dishes";
import {
  insertDish,
  editDish as repoEditDish,
  softDeleteDish,
  observeDishes,
} from "../repositories/dishRepository";
import { useMemo, useState, useEffect } from "react";
import type { Observable } from "rxjs";

function useObservableQuery<T>(
  observable$: Observable<T[]> | undefined,
  fallback: T[]
): T[] {
  const [value, setValue] = useState<T[]>(fallback);

  useEffect(() => {
    if (!observable$) return;
    const sub = observable$.subscribe(setValue);
    return () => sub.unsubscribe();
  }, [observable$]);

  return value;
}

export function useDishes() {
  const { db } = useDatabase();

  const dishes$ = useMemo(() => {
    if (!db) return undefined;
    return observeDishes(db);
  }, [db]);

  const dishes = useObservableQuery(dishes$, []);

  async function addDish(dish: DishDocType): Promise<void> {
    if (!db) throw new Error("Database not ready");
    await insertDish(db, dish);
  }

  async function editDish(
    id: string,
    fields: { name: string; description: string; course: number; seasons: number[] }
  ): Promise<void> {
    if (!db) throw new Error("Database not ready");
    await repoEditDish(db, id, fields);
  }

  async function removeDish(id: string): Promise<void> {
    if (!db) throw new Error("Database not ready");
    await softDeleteDish(db, id);
  }

  return { dishes, addDish, editDish, removeDish };
}
