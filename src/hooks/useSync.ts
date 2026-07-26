import { useEffect } from "react";
import { useDatabase } from "../db/DatabaseContext";
import { startAutoSync, sync } from "../services/syncService";

export function useSync() {
  const { db } = useDatabase();

  useEffect(() => {
    if (!db) return;
    const cleanup = startAutoSync(db);
    return cleanup;
  }, [db]);

  function triggerSync() {
    if (db) {
      void sync(db);
    }
  }

  return { triggerSync };
}
