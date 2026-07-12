import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RxCollection, RxDatabase } from "rxdb";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DishDocType {
  userId: string;
  name: string;
  description: string;
  course: number;
  seasons: number[];
  updated_at: string;
  is_deleted: boolean;
}

export type DishesCollection = RxCollection<DishDocType>;

export interface DatabaseCollections {
  dishes: DishesCollection;
}

export type AppDatabase = RxDatabase<DatabaseCollections>;

export interface DatabaseState {
  db: AppDatabase | null;
  isLoading: boolean;
  error: string | null;
}

// ── Context ───────────────────────────────────────────────────────────────────

const DatabaseContext = createContext<DatabaseState | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DatabaseState>({
    db: null,
    isLoading: true,
    error: null,
  });
  const initRef = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-invocation in development
    if (initRef.current) return;
    initRef.current = true;

    let disposed = false;
    let dbInstance: AppDatabase | null = null;

    (async () => {
      try {
        // 1. Register dev-mode plugin before creating the database
        if (import.meta.env.DEV) {
          const { RxDBDevModePlugin } = await import(
            "rxdb/plugins/dev-mode"
          );
          const { addRxPlugin } = await import("rxdb/plugins/core");
          addRxPlugin(RxDBDevModePlugin);
        }

        // 2. Import database utilities (cached — already loaded above in DEV)
        const { createRxDatabase } = await import("rxdb/plugins/core");
        const { getRxStorageDexie } = await import(
          "rxdb/plugins/storage-dexie"
        );
        const { wrappedValidateAjvStorage } = await import(
          "rxdb/plugins/validate-ajv"
        );

        // 3. Create storage and database
        const rawStorage = getRxStorageDexie();
        const validatedStorage = wrappedValidateAjvStorage({
          storage: rawStorage,
        });

        const db = await createRxDatabase<DatabaseCollections>({
          name: "dishes",
          storage: validatedStorage,
        });
        dbInstance = db;

        // 4. Add collections
        await db.addCollections({
          dishes: {
            schema: {
              version: 0,
              primaryKey: "userId",
              type: "object",
              properties: {
                userId: { type: "string", maxLength: 100 },
                name: { type: "string" },
                description: { type: "string" },
                course: { type: "number" },
                seasons: {
                  type: "array",
                  items: { type: "number" },
                },
                updated_at: { type: "string", format: "date-time" },
                is_deleted: { type: "boolean" },
              },
              required: [
                "userId",
                "name",
                "description",
                "course",
                "seasons",
                "updated_at",
                "is_deleted",
              ],
            },
          },
        });

        // 5. Only update state if the component is still mounted
        if (!disposed) {
          setState({
            db: db as unknown as AppDatabase,
            isLoading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!disposed) {
          const message =
            err instanceof Error
              ? err.message
              : "Unknown error initializing database";
          setState({ db: null, isLoading: false, error: message });
        }
      }
    })();

    // 6. Cleanup on unmount
    return () => {
      disposed = true;
      if (dbInstance) {
        (dbInstance as unknown as { destroy: () => Promise<void> }).destroy().catch(() => {
          /* intentional cleanup on unmount */
        });
      }
    };
  }, []);

  return (
    <DatabaseContext.Provider value={state}>
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
