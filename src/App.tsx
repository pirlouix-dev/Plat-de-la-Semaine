import { useEffect, useState } from "react";
import "./App.css";

import logo_img from "../assets/logo.png";
import choose_menu_img from "../assets/choose_menu.png";
import add_dish_img from "../assets/add_dish.png";
import edit_dish_img from "../assets/edit_dish.png";
import settings_img from "../assets/settings.png";

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

function App() {
  // On gère l'affichage via des états React
  const [message, setMessage] = useState<string>("...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // On passe les fonctions de mise à jour à notre fonction async
    fetchHelloMessage(setMessage, setError);
  }, []);

  // Sinon, on affiche le titre avec la variable dynamiquement mise à jour
  return (
    <div className="app-container">
      <img src={logo_img} alt="Plat de la Semaine" className="app-logo" />

      <main className="menu-grid">
        {mainMenuItems.map((item) => (
          <div key={item.id} className="menu-card-wrapper">
            {/* L'image de fond qui contient tout le graphisme */}
            <img
              src={item.icon}
              alt={item.text}
              className="card-background-img"
            />

            {/* Le texte superposé pile à l'emplacement du bouton bleu */}
            <div className="card-text-overlay">{item.text}</div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
