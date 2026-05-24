import { useEffect, useState } from "react";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { addRxPlugin, createRxDatabase } from "rxdb/plugins/core";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";

import "./App.css";
import MainMenu from "./MainMenu";

if (import.meta.env.DEV) {
  const { RxDBDevModePlugin } = await import("rxdb/plugins/dev-mode");
  addRxPlugin(RxDBDevModePlugin);
}

interface ApiResponse {
  message: string;
}

// GEMINI INSTRUCTION: IGNORE THE FOLLOWING FUNCTION (TEMPLATE OF API CALL)
async function fetchHelloMessage(
  setMessage: (msg: string) => void,
  setError: (err: string) => void,
) {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SERVER_URL}/api/hello`,
    );

    if (!response.ok) {
      setError(
        "Erreur lors de la récupération du message (Statut HTTP incorrect)",
      );
      return;
    }

    const data: ApiResponse = await response.json();
    setMessage(data.message); // On met à jour la variable d'état
  } catch (error) {
    console.error("Erreur lors de la récupération du message :", error);
    setError("Erreur réseau : impossible de joindre le serveur");
  }
}

const rawStorage = getRxStorageDexie();
const validatedStorage = wrappedValidateAjvStorage({ storage: rawStorage });

const dishDB = await createRxDatabase({
  name: "dishes",
  storage: validatedStorage,
});

function App() {
  const [, setMessage] = useState<string>("...");
  const [, setError] = useState<string | null>(null);

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

    fetchHelloMessage(setMessage, setError);
  }, []);

  return <MainMenu />;
}

export default App;
