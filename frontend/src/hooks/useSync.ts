import { useEffect } from "react";
import { useDatabase } from "../db/DatabaseContext";
import { useCurrentUserId } from "./useIsLoggedIn";
import { startAutoSync, sync } from "../services/syncService";
import { resetSyncStatus } from "../services/syncStatusStore";

export function useSync() {
  const { db, dbUserId } = useDatabase();
  const currentUserId = useCurrentUserId();

  useEffect(() => {
    if (!db) return;
    if (!currentUserId) return;
    // The database belongs to a per-account namespace. Never sync a database
    // that is still scoped to another account while switching.
    if (dbUserId !== currentUserId) return;

    resetSyncStatus();
    const cleanup = startAutoSync(db);
    return cleanup;
  }, [db, dbUserId, currentUserId]);

  function triggerSync() {
    if (db && dbUserId === currentUserId) {
      void sync(db);
    }
  }

  return { triggerSync };
}
