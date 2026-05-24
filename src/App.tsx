import { useEffect, useState } from "react";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { addRxPlugin, createRxDatabase } from "rxdb/plugins/core";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";

import "./App.css";

import logo_img from "../assets/logo.png";
import choose_menu_img from "../assets/choose_menu.webp";
import add_dish_img from "../assets/add_dish.webp";
import edit_dish_img from "../assets/edit_dish.webp";
import settings_img from "../assets/settings.webp";

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

const mainMenuItems = [
  { id: 1, text: "Choisir le menu", icon: choose_menu_img },
  { id: 2, text: "Ajouter un plat", icon: add_dish_img },
  { id: 3, text: "Modifier un plat", icon: edit_dish_img },
  { id: 4, text: "Paramètres", icon: settings_img },
];

const rawStorage = getRxStorageDexie();
const validatedStorage = wrappedValidateAjvStorage({ storage: rawStorage });

const dishDB = await createRxDatabase({
  name: "dishes",
  storage: validatedStorage,
});

function App() {
  const [message, setMessage] = useState<string>("...");
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="app-container">
      <img src={logo_img} alt="Plat de la Semaine" className="app-logo" />

      <main className="menu-grid">
        {mainMenuItems.map((item) => (
          <div key={item.id} className="menu-card-wrapper">
            <img
              src={item.icon}
              alt={item.text}
              className="card-background-img"
            />

            <div className="card-text-overlay">{item.text}</div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
