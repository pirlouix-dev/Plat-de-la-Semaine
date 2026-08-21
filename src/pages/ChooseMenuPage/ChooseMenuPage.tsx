import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon, TrashIcon } from "../../components/Icons";
import { Course, Season } from "../../types/dish";
import "./ChooseMenuPage.css";

interface DishPlaceholder {
  id: string;
  name: string;
  course: Course;
  seasons: Season[];
  description: string;
}

type ViewMode = "editing" | "recap";

const DISH_TYPE_INFO: Record<Course, { label: string; icon: string }> = {
  [Course.Starter]: { label: "Entrée", icon: "🥗" },
  [Course.Main]: { label: "Plat", icon: "🍽️" },
  [Course.Dessert]: { label: "Dessert", icon: "🍰" },
};

const SEASON_INFO: Record<Season, { label: string; icon: string }> = {
  [Season.Spring]: { label: "Printemps", icon: "🌱" },
  [Season.Summer]: { label: "Été", icon: "☀️" },
  [Season.Autumn]: { label: "Automne", icon: "🍂" },
  [Season.Winter]: { label: "Hiver", icon: "❄️" },
};

const INITIAL_QUEUE: DishPlaceholder[] = [
  {
    id: "1",
    name: "Taboulé & œufs durs",
    course: Course.Main,
    seasons: [Season.Spring, Season.Summer],
    description: "Ingrédients : Taboulé, 2 Œufs durs",
  },
  {
    id: "2",
    name: "Crevettes & riz",
    course: Course.Main,
    seasons: [Season.Spring, Season.Summer, Season.Autumn, Season.Winter],
    description: "Ingrédients : Crevettes, Riz, Sauce soja",
  },
  {
    id: "3",
    name: "Petits pois, carottes et lardon",
    course: Course.Main,
    seasons: [Season.Autumn, Season.Winter],
    description: "Ingrédients : Petits pois, carottes, lardons, oignons",
  },
  {
    id: "4",
    name: "Salade de tomates & mozzarella",
    course: Course.Starter,
    seasons: [Season.Summer],
    description:
      "Ingrédients : Tomates fraîches, Mozzarella di Bufala, Basilic",
  },
  {
    id: "5",
    name: "Tarte aux pommes",
    course: Course.Dessert,
    seasons: [Season.Autumn, Season.Winter],
    description:
      "Ingrédients : Pommes,VERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTION VERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTION VERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTIONVERYLONGDESCRIPTION",
  },
];

const STORAGE_KEY = "pdls_choose_menu_state_v1";

interface SavedMenuState {
  queue: DishPlaceholder[];
  selectedDishes: DishPlaceholder[];
  history: { action: "accept" | "reject"; dish: DishPlaceholder }[];
  mode: ViewMode;
}

function loadSavedState(): SavedMenuState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        queue: INITIAL_QUEUE,
        selectedDishes: [],
        history: [],
        mode: "editing",
      };
    return JSON.parse(raw) as SavedMenuState;
  } catch {
    return {
      queue: INITIAL_QUEUE,
      selectedDishes: [],
      history: [],
      mode: "editing",
    };
  }
}

export function ChooseMenuPage() {
  const navigate = useNavigate();

  const [initialState] = useState(loadSavedState);
  const [queue, setQueue] = useState<DishPlaceholder[]>(initialState.queue);
  const [selectedDishes, setSelectedDishes] = useState<DishPlaceholder[]>(
    initialState.selectedDishes,
  );
  const [history, setHistory] = useState<
    { action: "accept" | "reject"; dish: DishPlaceholder }[]
  >(initialState.history);
  const [mode, setMode] = useState<ViewMode>(initialState.mode);

  const [cardAnimation, setCardAnimation] = useState<
    "accept" | "reject" | "accept-undo" | "reject-undo" | null
  >(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const currentDish = queue[0] || null;

  // Persistance automatique
  useEffect(() => {
    const stateToSave: SavedMenuState = {
      queue,
      selectedDishes,
      history,
      mode,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [queue, selectedDishes, history, mode]);

  // Compteurs
  const counts = {
    starters: selectedDishes.filter((d) => d.course === Course.Starter).length,
    mains: selectedDishes.filter((d) => d.course === Course.Main).length,
    desserts: selectedDishes.filter((d) => d.course === Course.Dessert).length,
    total: selectedDishes.length,
  };

  // Actions d'édition
  const handleAccept = () => {
    if (!currentDish || cardAnimation) return;
    setCardAnimation("accept");
    setTimeout(() => {
      setSelectedDishes((prev) => [currentDish, ...prev]);
      setHistory((prev) => [{ action: "accept", dish: currentDish }, ...prev]);
      setQueue((prev) => prev.slice(1));
      setCardAnimation(null);
    }, 220);
  };

  const handleReject = () => {
    if (!currentDish || cardAnimation) return;
    setCardAnimation("reject");
    setTimeout(() => {
      setHistory((prev) => [{ action: "reject", dish: currentDish }, ...prev]);
      setQueue((prev) => prev.slice(1));
      setCardAnimation(null);
    }, 220);
  };

  const handleUndo = () => {
    if (history.length === 0 || cardAnimation) return;
    const lastItem = history[0];
    setHistory((prev) => prev.slice(1));

    if (lastItem.action === "accept") {
      setSelectedDishes((prev) =>
        prev.filter((d) => d.id !== lastItem.dish.id),
      );
    }
    setQueue((prev) => [lastItem.dish, ...prev]);
    setCardAnimation(
      lastItem.action === "accept" ? "accept-undo" : "reject-undo",
    );
    setTimeout(() => setCardAnimation(null), 220);
  };

  const handleResetConfirm = () => {
    setQueue(INITIAL_QUEUE);
    setSelectedDishes([]);
    setHistory([]);
    setMode("editing");
    setShowResetModal(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="choose-menu-container">
      {/* En-tête */}
      <header className="form-header">
        <button
          className="back-btn"
          onClick={() => navigate("/")}
          aria-label="Retour"
        >
          <BackArrowIcon size={20} />
        </button>
        <h1 className="page-title">
          {mode === "editing" ? "Choisir le menu" : "Menu de la semaine"}
        </h1>
        {selectedDishes.length > 0 || history.length > 0 ? (
          <button
            className="icon-delete-btn"
            onClick={() => setShowResetModal(true)}
            title="Réinitialiser"
            aria-label="Réinitialiser le menu"
          >
            <TrashIcon size={22} color="rgb(220, 57, 41)" />
          </button>
        ) : (
          <div className="header-spacer" />
        )}
      </header>

      {/* MODE ÉDITION */}
      {mode === "editing" && (
        <div className="choose-menu-layout">
          <main className="menu-main-column">
            {/* Carte proposée */}
            <section className="proposed-card-section">
              <h2 className="section-subtitle">Plat proposé</h2>

              {currentDish ? (
                <div
                  className={`dish-card active-card ${
                    cardAnimation ? `anim-${cardAnimation}` : ""
                  }`}
                >
                  <div className="card-header-row">
                    <span className="type-badge">
                      {DISH_TYPE_INFO[currentDish.course].icon}{" "}
                      {DISH_TYPE_INFO[currentDish.course].label}
                    </span>
                    <div className="seasons-badges">
                      {currentDish.seasons.map((s) => (
                        <span
                          key={s}
                          className="season-mini-tag"
                          title={SEASON_INFO[s].label}
                        >
                          {SEASON_INFO[s].icon}
                        </span>
                      ))}
                    </div>
                  </div>

                  <h3 className="dish-name">{currentDish.name}</h3>
                  {currentDish.description && (
                    <p className="dish-description">
                      {currentDish.description}
                    </p>
                  )}

                  <div className="card-decision-actions">
                    <button className="btn btn-refuse" onClick={handleReject}>
                      ✕ Refuser
                    </button>
                    <button className="btn btn-accept" onClick={handleAccept}>
                      ✓ Accepter
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-queue-card">
                  <p>🎉 Plus aucun plat à passer en revue !</p>
                </div>
              )}
            </section>

            {/* Menu en cours */}
            <section className="selected-dishes-section">
              <h2 className="section-subtitle">
                Menu sélectionné ({counts.total})
              </h2>

              {selectedDishes.length === 0 ? (
                <div className="empty-selected-placeholder">
                  Aucun plat accepté pour l'instant.
                </div>
              ) : (
                <div className="selected-dishes-list">
                  {selectedDishes.map((dish) => (
                    <div key={dish.id} className="dish-card selected-card">
                      <div className="card-header-row">
                        <span className="dish-name">{dish.name}</span>
                        <span className="type-badge">
                          {DISH_TYPE_INFO[dish.course].icon}{" "}
                          {DISH_TYPE_INFO[dish.course].label}
                        </span>
                      </div>
                      {dish.description && (
                        <p className="dish-description">{dish.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>

          {/* Sidebar Desktop */}
          <aside className="menu-sidebar">
            <div className="sidebar-card counters-card">
              <h3 className="sidebar-title">Récapitulatif</h3>
              <ul className="counters-list">
                <li>
                  <span>🥗 Entrées</span>
                  <strong>{counts.starters}</strong>
                </li>
                <li>
                  <span>🍽️ Plats</span>
                  <strong>{counts.mains}</strong>
                </li>
                <li>
                  <span>🍰 Desserts</span>
                  <strong>{counts.desserts}</strong>
                </li>
              </ul>
            </div>

            <div className="sidebar-actions">
              <button
                className="btn btn-revert"
                onClick={handleUndo}
                disabled={history.length === 0}
              >
                Annuler
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setMode("recap")}
                disabled={selectedDishes.length === 0}
              >
                Valider ({counts.total})
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MODE RÉCAPITULATIF (LECTURE SEULE / VALIDÉ) */}
      {mode === "recap" && (
        <div className="recap-layout">
          <div className="recap-status-banner">
            <span className="status-badge">🔒 Menu verrouillé</span>
            <p>Votre menu est sauvegardé. Idéal pour préparer vos repas !</p>
          </div>

          <div className="recap-dishes-grid">
            {[Course.Starter, Course.Main, Course.Dessert].map((course) => {
              const courseDishes = selectedDishes.filter(
                (d) => d.course === course,
              );
              if (courseDishes.length === 0) return null;

              return (
                <div key={course} className="recap-category-block">
                  <h3 className="category-title">
                    {DISH_TYPE_INFO[course].icon} {DISH_TYPE_INFO[course].label}
                    s ({courseDishes.length})
                  </h3>
                  <div className="category-cards">
                    {courseDishes.map((dish) => (
                      <div key={dish.id} className="dish-card recap-card">
                        <h4 className="dish-name">{dish.name}</h4>
                        {dish.description && (
                          <p className="dish-description">{dish.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barre d'action fixe ou latérale du mode récapitulatif */}
          <div className="recap-bottom-actions">
            <button
              className="btn btn-primary"
              onClick={() => setMode("editing")}
            >
              Modifier le menu
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setShowResetModal(true)}
            >
              Réinitialiser
            </button>
          </div>
        </div>
      )}

      {/* POPUP / MODALE DE CONFIRMATION DE RÉINITIALISATION */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Réinitialiser la liste ?</h3>
            <p className="modal-text">
              Voulez-vous vraiment effacer tous les plats sélectionnés et
              repartir de zéro ?
            </p>
            <p className="modal-text">Cette action est irréversible.</p>
            <div className="modal-actions">
              <button
                className="btn btn-revert"
                onClick={() => setShowResetModal(false)}
              >
                Annuler
              </button>
              <button className="btn btn-danger" onClick={handleResetConfirm}>
                Oui, réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChooseMenuPage;
