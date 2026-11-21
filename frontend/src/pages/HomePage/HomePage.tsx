import { useNavigate } from "react-router-dom";
import "./HomePage.css";

import { useSyncStatus } from "../../hooks/useSyncStatus";
import { useIsLoggedIn } from "../../hooks/useIsLoggedIn";
import { useWarmupPing } from "../../hooks/useWarmupPing";
import { useTranslation, type MessageKey } from "../../i18n";

import logo_img from "../../../assets/logo.png";
import book_img from "../../../assets/book.webp";
import add_img from "../../../assets/add.webp";
import pencil_img from "../../../assets/pencil.webp";
import gear_img from "../../../assets/gear.webp";
import textbox_img from "../../../assets/textbox.webp";

type MainMenuItem = {
  id: number;
  labelKey: MessageKey;
  icon: string;
  route: string;
  iconClassName?: string;
};

const mainMenuItems: MainMenuItem[] = [
  {
    id: 1,
    labelKey: "home.menu.choose",
    icon: book_img,
    route: "/choose",
    iconClassName: "card-icon--book",
  },
  { id: 2, labelKey: "home.menu.add", icon: add_img, route: "/add" },
  { id: 3, labelKey: "home.menu.edit", icon: pencil_img, route: "/edit" },
  {
    id: 4,
    labelKey: "home.menu.settings",
    icon: gear_img,
    route: "/settings",
  },
];

function HomePage() {
  const navigate = useNavigate();
  const username = localStorage.getItem("user_username");
  const isLoggedIn = useIsLoggedIn();
  const syncDisplay = useSyncStatus();
  const { t } = useTranslation();

  useWarmupPing(!isLoggedIn);

  return (
    <div className="app-container">
      <img src={logo_img} alt="Plat de la Semaine" className="app-logo" />

      <div className="account-card">
        <div className="account-info">
          <span className="account-title">
            {isLoggedIn
              ? t("home.greeting", { username: username ?? "" })
              : t("home.guestMode")}
          </span>
          <span
            className={
              "account-subtitle" +
              (syncDisplay.isError ? " account-subtitle--error" : "")
            }
          >
            {isLoggedIn ? syncDisplay.text : t("home.guestHint")}
          </span>
        </div>
        <button
          className="account-btn"
          onClick={() => navigate(isLoggedIn ? "/settings" : "/login")}
        >
          {isLoggedIn ? t("home.account") : t("home.signIn")}
        </button>
      </div>

      <main className="menu-grid">
        {mainMenuItems.map((item) => {
          const label = t(item.labelKey);
          return (
            <button
              key={item.id}
              className="menu-card-wrapper"
              onClick={() => navigate(item.route)}
            >
              <img
                src={item.icon}
                alt={label}
                className={
                  "card-icon" +
                  (item.iconClassName ? " " + item.iconClassName : "")
                }
              />

              <div className="card-textbox-container">
                <img src={textbox_img} alt="" className="textbox-bg" />
                <span className="card-text">{label}</span>
              </div>
            </button>
          );
        })}
      </main>
    </div>
  );
}

export default HomePage;
