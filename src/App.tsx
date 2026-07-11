import { useEffect } from "react";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { addRxPlugin, createRxDatabase } from "rxdb/plugins/core";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";

import "./App.css";
import MainMenu from "./MainMenu";

if (import.meta.env.DEV) {
  const { RxDBDevModePlugin } = await import("rxdb/plugins/dev-mode");
  addRxPlugin(RxDBDevModePlugin);
}

const rawStorage = getRxStorageDexie();
const validatedStorage = wrappedValidateAjvStorage({ storage: rawStorage });

const dishDB = await createRxDatabase({
  name: "dishes",
  storage: validatedStorage,
});

function App() {
  useEffect(() => {
    (async () => {
      await dishDB.addCollections({
        dishes: {
          schema: {
            version: 0,
            primaryKey: "userId",
            type: "object",
            properties: {
              userId: {
                type: "string",
                maxLength: 100,
              },
              name: {
                type: "string",
              },
              description: {
                type: "string",
              },
              course: {
                type: "number",
              },
              seasons: {
                type: "array",
                items: {
                  type: "number",
                },
              },
              updated_at: {
                type: "string",
                format: "date-time",
              },
              is_deleted: {
                type: "boolean",
              },
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
    })();
  }, []);

  return <MainMenu />;
}

export default App;
