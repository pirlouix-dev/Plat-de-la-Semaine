import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon, TrashIcon } from "../../components/Icons";
import {
  Course,
  Season,
  getCurrentSeason,
  isValidCourse,
  isValidSeason,
} from "../../types/dish";
import type { DishDocType } from "../../db/schemas/dishes";
import { useDishes } from "../../hooks/useDishes";
import { shuffle } from "../../utils/shuffle";
import "./ChooseDishesPage.css";

type ViewMode = "editing" | "recap";

type HistoryAction = { action: "accept" | "reject"; dishId: string };

const DISH_COURSE_INFO: Record<Course, { label: string; icon: string }> = {
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

const STORAGE_KEY = "pdls_choose_menu_state_v2";

const PASSES_PER_DISH = 3;

interface SavedMenuState {
  queueIds: string[];
  selectedIds: string[];
  history: HistoryAction[];
  mode: ViewMode;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function loadSavedState(): SavedMenuState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedMenuState>;
    if (!Array.isArray(parsed.queueIds)) return null;
    const history = Array.isArray(parsed.history)
      ? parsed.history.filter(
          (h): h is HistoryAction =>
            !!h &&
            typeof h === "object" &&
            (h.action === "accept" || h.action === "reject") &&
            typeof h.dishId === "string",
        )
      : [];
    return {
      queueIds: toStringArray(parsed.queueIds),
      selectedIds: toStringArray(parsed.selectedIds),
      history,
      mode: parsed.mode === "recap" ? "recap" : "editing",
    };
  } catch {
    return null;
  }
}

function isRenderableDish(dish: DishDocType): boolean {
  return (
    isValidCourse(dish.course) &&
    dish.seasons.every((s) => isValidSeason(s as Season))
  );
}

function isInSeason(dish: DishDocType, season: Season): boolean {
  return dish.seasons.includes(season);
}

interface SessionState {
  queueIds: string[];
  selectedIds: string[];
  history: HistoryAction[];
}

const NO_IDS: string[] = [];
const NO_HISTORY: HistoryAction[] = [];

function buildFreshQueue(dishes: DishDocType[]): string[] {
  const season = getCurrentSeason();
  const ids = shuffle(
    dishes.filter((d) => isRenderableDish(d) && isInSeason(d, season)),
  ).map((d) => d.id);
  return Array.from({ length: PASSES_PER_DISH }, () => ids).flat();
}

function resolveSavedSession(
  saved: SavedMenuState,
  dishMap: Map<string, DishDocType>,
): SessionState {
  return {
    queueIds: saved.queueIds.filter((id) => dishMap.has(id)),
    selectedIds: saved.selectedIds.filter((id) => dishMap.has(id)),
    history: saved.history,
  };
}

export function ChooseDishesPage() {
  const navigate = useNavigate();
  const { dishes, isLoaded } = useDishes();

  const [initialSaved] = useState(() => {
    const saved = loadSavedState();
    return saved && saved.history.length > 0 ? saved : null;
  });
  const [mode, setMode] = useState<ViewMode>(initialSaved?.mode ?? "editing");

  const [cardAnimation, setCardAnimation] = useState<
    "accept" | "reject" | "accept-undo" | "reject-undo" | null
  >(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [expandedDishIds, setExpandedDishIds] = useState<
    Record<string, boolean>
  >({});

  const dishMap = useMemo(() => {
    const map = new Map<string, DishDocType>();
    for (const dish of dishes) {
      if (isRenderableDish(dish)) map.set(dish.id, dish);
    }
    return map;
  }, [dishes]);

  const resolvedSession = useMemo(() => {
    if (!isLoaded) return null;
    return initialSaved
      ? resolveSavedSession(initialSaved, dishMap)
      : { queueIds: buildFreshQueue(dishes), selectedIds: [], history: [] };
  }, [isLoaded, initialSaved, dishMap, dishes]);

  const [sessionOverride, setSessionOverride] = useState<SessionState | null>(
    null,
  );
  const session = sessionOverride ?? resolvedSession;

  const queueIds = session?.queueIds ?? NO_IDS;
  const selectedIds = session?.selectedIds ?? NO_IDS;
  const history = session?.history ?? NO_HISTORY;

  useEffect(() => {
    if (!session) return;
    const stateToSave: SavedMenuState = {
      queueIds,
      selectedIds,
      history,
      mode,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [session, mode, queueIds, selectedIds, history]);

  const queue = useMemo(
    () =>
      queueIds
        .map((id) => dishMap.get(id))
        .filter((d): d is DishDocType => !!d),
    [queueIds, dishMap],
  );
  const selectedDishes = useMemo(
    () =>
      selectedIds
        .map((id) => dishMap.get(id))
        .filter((d): d is DishDocType => !!d),
    [selectedIds, dishMap],
  );

  const currentDish = queue[0] || null;

  const counts = {
    starters: selectedDishes.filter((d) => d.course === Course.Starter).length,
    mains: selectedDishes.filter((d) => d.course === Course.Main).length,
    desserts: selectedDishes.filter((d) => d.course === Course.Dessert).length,
    total: selectedDishes.length,
  };

  const toggleExpand = (dishId: string) => {
    setExpandedDishIds((prev) => ({
      ...prev,
      [dishId]: !prev[dishId],
    }));
  };

  const renderSeasonsBadges = (dishSeasons: Season[]) => {
    if (dishSeasons.length === Object.keys(SEASON_INFO).length) {
      return <span className="season-mini-tag">🗓️ Toutes saisons</span>;
    }

    return dishSeasons.map((s) => (
      <span key={s} className="season-mini-tag">
        {SEASON_INFO[s].icon} {SEASON_INFO[s].label}
      </span>
    ));
  };

  const renderDescription = (dish: DishDocType) => {
    if (!dish.description) return null;
    const isExpanded = !!expandedDishIds[dish.id];
    const isLong = dish.description.length > 90;

    return (
      <div className="description-wrapper">
        <p className={`dish-description ${isExpanded ? "expanded" : ""}`}>
          {dish.description}
        </p>
        {isLong && (
          <button
            type="button"
            className="see-more-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(dish.id);
            }}
          >
            {isExpanded ? "Voir moins" : "Voir plus"}
          </button>
        )}
      </div>
    );
  };

  const handleAccept = () => {
    if (!currentDish || cardAnimation || !session) return;
    setCardAnimation("accept");
    setTimeout(() => {
      setSessionOverride({
        queueIds: session.queueIds.slice(1),
        selectedIds: [currentDish.id, ...session.selectedIds],
        history: [
          { action: "accept", dishId: currentDish.id },
          ...session.history,
        ],
      });
      setCardAnimation(null);
    }, 220);
  };

  const handleReject = () => {
    if (!currentDish || cardAnimation || !session) return;
    setCardAnimation("reject");
    setTimeout(() => {
      setSessionOverride({
        queueIds: session.queueIds.slice(1),
        selectedIds: session.selectedIds,
        history: [
          { action: "reject", dishId: currentDish.id },
          ...session.history,
        ],
      });
      setCardAnimation(null);
    }, 220);
  };

  const handleUndo = () => {
    if (history.length === 0 || cardAnimation || !session) return;
    const [lastItem, ...rest] = history;

    const next: SessionState = {
      queueIds: session.queueIds,
      selectedIds: session.selectedIds,
      history: rest,
    };
    if (dishMap.has(lastItem.dishId)) {
      if (lastItem.action === "accept") {
        const idx = next.selectedIds.indexOf(lastItem.dishId);
        if (idx !== -1) {
          next.selectedIds = next.selectedIds.filter((_, i) => i !== idx);
        }
      }
      next.queueIds = [lastItem.dishId, ...next.queueIds];
      setSessionOverride(next);
      setCardAnimation(
        lastItem.action === "accept" ? "accept-undo" : "reject-undo",
      );
      setTimeout(() => setCardAnimation(null), 220);
    } else {
      setSessionOverride(next);
    }
  };

  const handleResetConfirm = () => {
    setSessionOverride({
      queueIds: buildFreshQueue(dishes),
      selectedIds: [],
      history: [],
    });
    setMode("editing");
    setShowResetModal(false);
    setExpandedDishIds({});
  };

  return (
    <div className="choose-menu-container">
      <header className="form-header">
        <button
          className="back-btn"
          onClick={() => navigate("/")}
          aria-label="Retour"
        >
          <BackArrowIcon size={20} />
        </button>
        <h1 className="page-title">
          {mode === "editing" ? "Choisir les plats" : "Plats sauvegardés"}
        </h1>
        {selectedDishes.length > 0 || history.length > 0 ? (
          <button
            className="icon-delete-btn"
            onClick={() => setShowResetModal(true)}
            title="Réinitialiser"
            aria-label="Réinitialiser les plats"
          >
            <TrashIcon size={22} color="rgb(220, 57, 41)" />
          </button>
        ) : (
          <div className="header-spacer" />
        )}
      </header>

      {mode === "editing" && (
        <div className="choose-menu-layout">
          <main className="menu-main-column">
            <section className="proposed-card-section">
              <h2 className="section-subtitle">Plat proposé</h2>

              {currentDish ? (
                <div
                  className={`dish-card active-card ${
                    cardAnimation ? `anim-${cardAnimation}` : ""
                  }`}
                >
                  <div className="card-header-row">
                    <h3 className="dish-name">{currentDish.name}</h3>
                    <span className="course-badge">
                      {DISH_COURSE_INFO[currentDish.course as Course].icon}{" "}
                      {DISH_COURSE_INFO[currentDish.course as Course].label}
                    </span>
                  </div>

                  <div className="seasons-badges">
                    {renderSeasonsBadges(currentDish.seasons as Season[])}
                  </div>

                  {renderDescription(currentDish)}

                  <div className="card-decision-actions">
                    <button className="btn btn-refuse" onClick={handleReject}>
                      ✕ Refuser
                    </button>
                    <button className="btn btn-accept" onClick={handleAccept}>
                      ✓ Accepter
                    </button>
                  </div>
                </div>
              ) : !session ? (
                <div className="empty-queue-card">
                  <p>Chargement des plats…</p>
                </div>
              ) : (
                <div className="empty-queue-card">
                  {dishes.length === 0 ? (
                    <>
                      <p>Aucun plat disponible.</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => navigate("/add")}
                      >
                        Ajouter un plat
                      </button>
                    </>
                  ) : dishMap.size === 0 ||
                    dishes.filter(
                      (d) =>
                        isRenderableDish(d) &&
                        isInSeason(d, getCurrentSeason()),
                    ).length === 0 ? (
                    <p>🍂 Aucun plat de saison pour le moment.</p>
                  ) : (
                    <p>Tous les plats ont été passés en revue.</p>
                  )}
                </div>
              )}
            </section>

            <section className="selected-dishes-section">
              <h2 className="section-subtitle">
                Plats sélectionnés ({counts.total})
              </h2>

              {selectedDishes.length === 0 ? (
                <div className="empty-selected-placeholder">
                  Aucun plat accepté pour l'instant.
                </div>
              ) : (
                <div className="selected-dishes-list">
                  {selectedDishes.map((dish, index) => (
                    <div
                      key={`${dish.id}-${index}`}
                      className="dish-card selected-card"
                    >
                      <div className="card-header-row">
                        <span className="dish-name">{dish.name}</span>
                        <span className="course-badge">
                          {DISH_COURSE_INFO[dish.course as Course].icon}{" "}
                          {DISH_COURSE_INFO[dish.course as Course].label}
                        </span>
                      </div>
                      <div className="seasons-badges">
                        {renderSeasonsBadges(dish.seasons as Season[])}
                      </div>
                      {renderDescription(dish)}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>

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

      {mode === "recap" && (
        <div className="recap-layout">
          <div className="recap-dishes-grid">
            {[Course.Starter, Course.Main, Course.Dessert].map((course) => {
              const courseDishes = selectedDishes.filter(
                (d) => d.course === course,
              );
              if (courseDishes.length === 0) return null;

              return (
                <div key={course} className="recap-category-block">
                  <h3 className="category-title">
                    {DISH_COURSE_INFO[course].icon}{" "}
                    {DISH_COURSE_INFO[course].label}s ({courseDishes.length})
                  </h3>
                  <div className="category-cards">
                    {courseDishes.map((dish, index) => (
                      <div
                        key={`${dish.id}-${index}`}
                        className="dish-card recap-card"
                      >
                        <h4 className="dish-name">{dish.name}</h4>
                        {renderDescription(dish)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="recap-bottom-actions">
            <button
              className="btn btn-primary"
              onClick={() => setMode("editing")}
            >
              Modifier les plats
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

export default ChooseDishesPage;
