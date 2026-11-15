import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RxDatabase } from "rxdb";
import { getDatabaseManager } from "./databaseManagerInstance";
import { useCurrentUserId } from "../hooks/useIsLoggedIn";
import type { DishDocType } from "./schemas/dishes";
import type { DatabaseCollections } from "./collections";

// ── Re-export types ──────────────────────────────────────────────────────────

export type { DishDocType };
export type { DatabaseCollections };

export type AppDatabase = RxDatabase<DatabaseCollections>;

export interface DatabaseState {
  db: AppDatabase | null;
  isLoading: boolean;
  error: string | null;
  /**
   * Account the current database belongs to, or `null` for the guest database
   * (and while the database is loading).
   */
  dbUserId: string | null;
}

// ── Context ───────────────────────────────────────────────────────────────────

const DatabaseContext = createContext<DatabaseState | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const userId = useCurrentUserId();
  const [state, setState] = useState<DatabaseState>({
    db: null,
    isLoading: true,
    error: null,
    dbUserId: null,
  });

  // Guards against an older async switch publishing after a newer one.
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    let cancelled = false;

    void (async () => {
      const manager = await getDatabaseManager();
      if (cancelled || generation !== generationRef.current) return;

      const db = await manager.openForUser(userId);
      if (cancelled || generation !== generationRef.current) return;

      setState({ db, isLoading: false, error: null, dbUserId: userId });
    })().catch((err: unknown) => {
      if (cancelled || generation !== generationRef.current) return;

      console.error("Database initialization failed:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Unknown error initializing database";
      setState({ db: null, isLoading: false, error: message, dbUserId: userId });
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Hide the database until it belongs to the account that is logged in now,
  // which prevents showing the previous account's dishes during the switch.
  const value = useMemo<DatabaseState>(() => {
    const matches = state.dbUserId === userId;
    return {
      db: matches ? state.db : null,
      isLoading: state.isLoading || !matches,
      error: matches ? state.error : null,
      dbUserId: matches ? state.dbUserId : null,
    };
  }, [state, userId]);

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useDatabase(): DatabaseState {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error("useDatabase must be used within a <DatabaseProvider>");
  }
  return ctx;
}
