import { useEffect, useState } from "react";
import "./App.css";

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

function App() {
  // On gère l'affichage via des états React
  const [message, setMessage] = useState<string>("...");
  const [error, setError] = useState<string | null>(null);

  const LOGO_IMG = "assets/logo.png";
  const CHOOSE_MENU_IMG = "assets/choose_menu.png";
  const ADD_DISH_IMG = "assets/add_dish.png";
  const EDIT_DISH_IMG = "assets/edit_dish.png";
  const SETTINGS_IMG = "assets/settings.png";

  const mainMenuItems = [
    { id: 1, text: "Choisir le menu", icon: CHOOSE_MENU_IMG },
    { id: 2, text: "Ajouter un plat", icon: ADD_DISH_IMG },
    { id: 3, text: "Modifier un plat", icon: EDIT_DISH_IMG },
    { id: 4, text: "Paramètres", icon: SETTINGS_IMG },
  ];

  useEffect(() => {
    // On passe les fonctions de mise à jour à notre fonction async
    fetchHelloMessage(setMessage, setError);
  }, []);

  // Sinon, on affiche le titre avec la variable dynamiquement mise à jour
  return (
    <div className="app-container">
      <img src={LOGO_IMG} alt="Plat de la Semaine" className="app-logo" />

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
