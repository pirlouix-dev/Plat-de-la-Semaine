import { useNavigate } from "react-router-dom";
import "./MainMenuPage.css";

import logo_img from "../../assets/logo.png";
import book_img from "../../assets/book.webp";
import add_img from "../../assets/add.webp";
import pencil_img from "../../assets/pencil.webp";
import wheel_img from "../../assets/wheel.webp";
import textbox_img from "../../assets/textbox.webp";

const mainMenuItems = [
  { id: 1, text: "Choisir le menu", icon: book_img, route: "/choose" },
  { id: 2, text: "Ajouter un plat", icon: add_img, route: "/add" },
  { id: 3, text: "Modifier un plat", icon: pencil_img, route: "/edit" },
  { id: 4, text: "Paramètres", icon: wheel_img, route: "/settings" },
];

function MainMenuPage() {
  const navigate = useNavigate();
  const isLoggedIn = true; // Remplacez par votre logique d'authentification réelle

  return (
    <div className="app-container">
      <img src={logo_img} alt="Plat de la Semaine" className="app-logo" />

      {/* --- CARTE COMPTE (PROPOSITION 1) --- */}
      <div className="account-card">
        <div className="account-info">
          <span className="account-title">
            {isLoggedIn ? "Bonjour, Mathéo !" : "Mode Invité"}
          </span>
          <span className="account-subtitle">
            {isLoggedIn
              ? "Vos plats sont synchronisés"
              : "Connectez-vous pour sauvegarder vos plats"}
          </span>
        </div>
        <button
          className="account-btn"
          onClick={() => navigate(isLoggedIn ? "/settings" : "/login")}
        >
          {isLoggedIn ? "Mon compte" : "Se connecter"}
        </button>
      </div>

      <main className="menu-grid">
        {mainMenuItems.map((item) => (
          <button
            key={item.id}
            className="menu-card-wrapper"
            onClick={() => navigate(item.route)}
          >
            <img src={item.icon} alt={item.text} className="card-icon" />

            <div className="card-textbox-container">
              <img src={textbox_img} alt="" className="textbox-bg" />
              <span className="card-text">{item.text}</span>
            </div>
          </button>
        ))}
      </main>
    </div>
  );
}

export default MainMenuPage;
