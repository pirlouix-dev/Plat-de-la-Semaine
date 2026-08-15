import { useEffect } from "react";
import { useDatabase } from "../db/DatabaseContext";
import { useIsLoggedIn } from "./useIsLoggedIn";
import { startAutoSync, sync } from "../services/syncService";

export function useSync() {
  const { db } = useDatabase();
  const isLoggedIn = useIsLoggedIn();

  useEffect(() => {
    if (!db) return;
    if (!isLoggedIn) return;
    const cleanup = startAutoSync(db);
    return cleanup;
  }, [db, isLoggedIn]);

  function triggerSync() {
    if (db) {
      void sync(db);
    }
  }

  return { triggerSync };
}
