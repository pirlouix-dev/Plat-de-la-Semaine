import { useNavigate } from "react-router-dom";
import "./MainMenu.css";

import logo_img from "../assets/logo.png";
import choose_menu_img from "../assets/choose_menu.webp";
import add_dish_img from "../assets/add_dish.webp";
import edit_dish_img from "../assets/edit_dish.webp";
import settings_img from "../assets/settings.webp";

const mainMenuItems = [
  { id: 1, text: "Choisir le menu", icon: choose_menu_img, route: "/choose" },
  { id: 2, text: "Ajouter un plat", icon: add_dish_img, route: "/add" },
  { id: 3, text: "Modifier un plat", icon: edit_dish_img, route: "/edit" },
  { id: 4, text: "Paramètres", icon: settings_img, route: "/settings" },
];

function MainMenu() {
  const navigate = useNavigate();

  return (
    <div className="app-container">
      <img src={logo_img} alt="Plat de la Semaine" className="app-logo" />

      <main className="menu-grid">
        {mainMenuItems.map((item) => (
          <div
            key={item.id}
            className="menu-card-wrapper"
            role="button"
            tabIndex={0}
            onClick={() => navigate(item.route)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(item.route);
              }
            }}
          >
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

export default MainMenu;
