import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { RxDatabase } from "rxdb";
import { hashFunction } from "./hashFunction";
import { dishesSchema, type DishDocType } from "./schemas/dishes";
import { preferencesSchema } from "./schemas/preferences";
import type { DatabaseCollections } from "./collections";

// ── Re-export types ──────────────────────────────────────────────────────────

export type { DishDocType };
export type { DatabaseCollections };

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

  useEffect(() => {
    (async () => {
      try {
        if (import.meta.env.DEV) {
          const { RxDBDevModePlugin } = await import("rxdb/plugins/dev-mode");
          const { addRxPlugin } = await import("rxdb/plugins/core");
          addRxPlugin(RxDBDevModePlugin);
        }

        const { createRxDatabase } = await import("rxdb/plugins/core");
        const { getRxStorageDexie } =
          await import("rxdb/plugins/storage-dexie");
        const { wrappedValidateAjvStorage } =
          await import("rxdb/plugins/validate-ajv");

        const rawStorage = getRxStorageDexie();
        const validatedStorage = wrappedValidateAjvStorage({
          storage: rawStorage,
        });

        const db = await createRxDatabase<DatabaseCollections>({
          name: "pdlsv4",
          storage: validatedStorage,
          ignoreDuplicate: true,
          hashFunction,
        });

        await db.addCollections({
          dishes: {
            schema: dishesSchema,
          },
          preferences: {
            schema: preferencesSchema,
          },
        });

        setState({
          db: db as unknown as AppDatabase,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unknown error initializing database";
        setState({ db: null, isLoading: false, error: message });
      }
    })();
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
