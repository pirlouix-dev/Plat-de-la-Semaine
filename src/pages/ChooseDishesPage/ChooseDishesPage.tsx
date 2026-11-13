import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon, TrashIcon } from "../../components/Icons";
import { ExpandableDescription } from "../../components/ExpandableDescription";
import {
  Course,
  Season,
  getCurrentSeason,
  isValidCourse,
  isValidSeason,
} from "../../types/dish";
import type { DishDocType } from "../../db/schemas/dishes";
import { useDishes } from "../../hooks/useDishes";
import { useIsLoggedIn } from "../../hooks/useIsLoggedIn";
import { useSyncState } from "../../hooks/useSyncStatus";
import { getCurrentUserId } from "../../services/api";
import {
  type HistoryAction,
  type RemoteMenu,
  type SavedMenuState,
  type StoredMenu,
  type ViewMode,
  beginMenuSave,
  getPendingRemoteMenu,
  loadStoredMenu,
  markMenuModified,
  storeMenu,
  subscribeMenuEvents,
} from "../../services/menuStorage";
import { resolveMenuConflict, saveMenuNow } from "../../services/syncService";
import { shuffle } from "../../utils/shuffle";
import { areDishesReady } from "../../utils/dishesReady";
import "./ChooseDishesPage.css";

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

const PASSES_PER_DISH = 3;

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

function formatRemoteMenuTimestamp(updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function describeRemoteMenu(remote: RemoteMenu): string {
  const count = remote.selectedDishIds.length;
  const content =
    count === 0
      ? "est vide"
      : `contient ${count} plat${count > 1 ? "s" : ""}`;
  const date = formatRemoteMenuTimestamp(remote.updatedAt);
  return date
    ? `La version distante du ${date} ${content}.`
    : `La version distante ${content}.`;
}

export function ChooseDishesPage() {
  const navigate = useNavigate();
  const { dishes, isLoaded } = useDishes();
  const isLoggedIn = useIsLoggedIn();
  const syncState = useSyncState();
  const userId = isLoggedIn ? getCurrentUserId() : null;

  const dishesReady = areDishesReady({
    isLoaded,
    hasDishes: dishes.length > 0,
    isLoggedIn,
    online: syncState.online,
    hasSyncedOnce:
      syncState.lastSyncAt !== null || syncState.lastErrorAt !== null,
  });

  const [initialSaved] = useState<SavedMenuState | null>(() => {
    const saved = loadStoredMenu(userId);
    if (!saved) return null;
    return saved.selectedIds.length > 0 || saved.history.length > 0
      ? saved
      : null;
  });
  const [mode, setMode] = useState<ViewMode>(initialSaved?.mode ?? "editing");
  const [conflict, setConflict] = useState<RemoteMenu | null>(() =>
    getPendingRemoteMenu(userId),
  );
  const [pendingRemoteApply, setPendingRemoteApply] =
    useState<StoredMenu | null>(null);

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

  const [session, setSession] = useState<SessionState | null>(null);
  const initializedRef = useRef(false);

  // Keep the banner and the live session in sync with menu sync events.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the conflict that may have started before mount
    setConflict(getPendingRemoteMenu(userId));
    return subscribeMenuEvents((event) => {
      if (event.userId !== userId) return;
      if (event.type === "conflict") {
        setConflict(event.remote);
      } else if (event.type === "conflict-cleared") {
        setConflict(null);
      } else {
        setPendingRemoteApply(event.menu);
      }
    });
  }, [userId]);

  // A remote menu was adopted while this page was open. Rebuild the review
  // session from it once the dish set is available.
  useEffect(() => {
    if (!pendingRemoteApply || !dishesReady) return;
    // Prevent the one-time local session builder from overwriting this menu.
    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the remote menu arrives through the sync engine
    setSession({
      queueIds: buildFreshQueue(dishes),
      selectedIds: pendingRemoteApply.selectedIds,
      history: [],
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the remote menu arrives through the sync engine
    setMode(pendingRemoteApply.mode);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consume the applied remote menu once
    setPendingRemoteApply(null);
  }, [pendingRemoteApply, dishesReady, dishes]);

  // Build the review session exactly once, when the dish set is ready, then keep
  // it frozen. The dish collection keeps changing while the sync engine runs, so
  // rebuilding here would reshuffle the queue under the user's cursor.
  useEffect(() => {
    if (initializedRef.current || !dishesReady) return;
    initializedRef.current = true;
    setSession(
      initialSaved
        ? {
            // A selection restored from another device has no local review
            // session, so a fresh queue is built to review it.
            queueIds:
              initialSaved.queueIds.length === 0 &&
              initialSaved.history.length === 0
                ? buildFreshQueue(dishes)
                : initialSaved.queueIds,
            selectedIds: initialSaved.selectedIds,
            history: initialSaved.history,
          }
        : { queueIds: buildFreshQueue(dishes), selectedIds: [], history: [] },
    );
  }, [dishesReady, initialSaved, dishes]);

  // Until the user has made a decision, an empty queue may still be waiting for
  // dishes to sync in (e.g. first open while offline). Fill it once they arrive
  // without disturbing a queue the user is already working through.
  useEffect(() => {
    if (!dishesReady || !session) return;
    if (session.queueIds.length > 0) return;
    if (session.history.length > 0 || session.selectedIds.length > 0) return;
    const fresh = buildFreshQueue(dishes);
    if (fresh.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the queue is completed from dishes arriving through the sync engine
    setSession({ ...session, queueIds: fresh });
  }, [dishes, dishesReady, session]);

  const queueIds = session?.queueIds ?? NO_IDS;
  const selectedIds = session?.selectedIds ?? NO_IDS;
  const history = session?.history ?? NO_HISTORY;

  useEffect(() => {
    if (!session) return;
    storeMenu(userId, {
      queueIds: session.queueIds,
      selectedIds: session.selectedIds,
      history: session.history,
      mode,
    });
  }, [session, mode, userId]);

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

  const handleAccept = () => {
    if (!currentDish || cardAnimation || !session) return;
    setCardAnimation("accept");
    setTimeout(() => {
      markMenuModified(userId);
      setSession({
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
      markMenuModified(userId);
      setSession({
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
      markMenuModified(userId);
      setSession(next);
      setCardAnimation(
        lastItem.action === "accept" ? "accept-undo" : "reject-undo",
      );
      setTimeout(() => setCardAnimation(null), 220);
    } else {
      markMenuModified(userId);
      setSession(next);
    }
  };

  const handleValidate = () => {
    if (!session) return;
    beginMenuSave(
      userId,
      {
        queueIds: session.queueIds,
        selectedIds: session.selectedIds,
        history: session.history,
        mode: "recap",
      },
      session.selectedIds,
    );
    setMode("recap");
    void saveMenuNow();
  };

  const handleResetConfirm = () => {
    const freshQueue = buildFreshQueue(dishes);
    setSession({
      queueIds: freshQueue,
      selectedIds: [],
      history: [],
    });
    setMode("editing");
    setShowResetModal(false);
    setExpandedDishIds({});

    // Clearing is an explicit save of the empty menu.
    beginMenuSave(
      userId,
      {
        queueIds: freshQueue,
        selectedIds: [],
        history: [],
        mode: "editing",
      },
      [],
    );
    void saveMenuNow();
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

      {conflict && (
        <div className="menu-sync-banner" role="status">
          <div className="menu-sync-banner-text">
            <strong>Un menu a été enregistré sur un autre appareil.</strong>
            <span>{describeRemoteMenu(conflict)}</span>
          </div>
          <div className="menu-sync-banner-actions">
            <button
              className="btn btn-revert"
              onClick={() => void resolveMenuConflict("keep")}
            >
              Garder mon menu
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void resolveMenuConflict("load")}
            >
              Charger le menu distant
            </button>
          </div>
        </div>
      )}

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

                  <ExpandableDescription
                    description={currentDish.description}
                    descriptionClassName="dish-description"
                    expanded={!!expandedDishIds[`proposed:${currentDish.id}`]}
                    onToggle={() => toggleExpand(`proposed:${currentDish.id}`)}
                  />

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
                      <ExpandableDescription
                        description={dish.description}
                        descriptionClassName="dish-description"
                        expanded={!!expandedDishIds[`selected:${dish.id}:${index}`]}
                        onToggle={() =>
                          toggleExpand(`selected:${dish.id}:${index}`)
                        }
                      />
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
                onClick={handleValidate}
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
                        <ExpandableDescription
                          description={dish.description}
                          descriptionClassName="dish-description"
                          expanded={
                            !!expandedDishIds[`recap:${course}:${index}`]
                          }
                          onToggle={() =>
                            toggleExpand(`recap:${course}:${index}`)
                          }
                        />
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
