import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon, FilterIcon, TrashIcon } from "../../components/Icons";
import CharacterCounter from "../../components/CharacterCounter";
import { useToast } from "../../components/toastContext";
import { useDishes } from "../../hooks/useDishes";
import type { DishDocType } from "../../db/schemas/dishes";
import {
  Course,
  Season,
  COURSE_LABELS,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from "../../types/dish";
import "./EditDishPage.css";

const DISH_TYPES: { label: string; icon: string; course: Course }[] = [
  { label: "Entrée", icon: "🥗", course: Course.Starter },
  { label: "Plat", icon: "🍽️", course: Course.Main },
  { label: "Dessert", icon: "🍰", course: Course.Dessert },
];

const SEASONS: { label: string; icon: string; season: Season }[] = [
  { label: "Printemps", icon: "🌱", season: Season.Spring },
  { label: "Été", icon: "☀️", season: Season.Summer },
  { label: "Automne", icon: "🍂", season: Season.Autumn },
  { label: "Hiver", icon: "❄️", season: Season.Winter },
];

function EditDishPage() {
  const navigate = useNavigate();
  const { dishes, editDish, removeDish } = useDishes();
  const { showToast } = useToast();

  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterTypes, setFilterTypes] = useState<Course[]>([]);
  const [filterSeasons, setFilterSeasons] = useState<Season[]>([]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedDish =
    (dishes.find((d) => d.id === selectedDishId) as DishDocType | undefined) ||
    null;
  const [name, setName] = useState("");
  const [course, setCourse] = useState<Course | null>(null);
  const [selectedSeasons, setSelectedSeasons] = useState<Season[]>([]);
  const [description, setDescription] = useState("");

  const handleSelectDish = (dish: DishDocType) => {
    setSelectedDishId(dish.id);
    setName(dish.name);
    setCourse(dish.course as Course);
    setSelectedSeasons(dish.seasons as Season[]);
    setDescription(dish.description);
  };

  const handleDeselectDish = () => {
    setSelectedDishId(null);
  };

  const toggleSeason = (season: Season) => {
    setSelectedSeasons((prev) =>
      prev.includes(season)
        ? prev.filter((s) => s !== season)
        : [...prev, season],
    );
  };

  const toggleFilterType = (type: Course) => {
    setFilterTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const toggleFilterSeason = (season: Season) => {
    setFilterSeasons((prev) =>
      prev.includes(season)
        ? prev.filter((s) => s !== season)
        : [...prev, season],
    );
  };

  const activeFiltersCount = filterTypes.length + filterSeasons.length;

  const filteredDishes = dishes.filter((dish) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === "" ||
      dish.name.toLowerCase().includes(q) ||
      dish.description.toLowerCase().includes(q);

    const matchesType =
      filterTypes.length === 0 || filterTypes.includes(dish.course as Course);

    const matchesSeason =
      filterSeasons.length === 0 ||
      dish.seasons.some((s) => filterSeasons.includes(s as Season));

    return matchesSearch && matchesType && matchesSeason;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDishId || course === null) return;

    setSaving(true);
    try {
      await editDish(selectedDishId, {
        name,
        description,
        course,
        seasons: selectedSeasons,
      });
      showToast("Plat modifié avec succès", "success");
    } catch {
      showToast("Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDishId) return;

    try {
      await removeDish(selectedDishId);
      setSelectedDishId(null);
      setShowDeleteModal(false);
      showToast("Plat supprimé", "success");
    } catch {
      showToast("Erreur lors de la suppression", "error");
    }
  };

  const renderSeasonsBadges = (dishSeasons: number[]) => {
    if (dishSeasons.length === SEASONS.length) {
      return <span className="dish-card-season-badge">🗓️ Toutes saisons</span>;
    }

    return dishSeasons.map((s) => {
      const seasonObj = SEASONS.find((item) => item.season === s);
      if (!seasonObj) return null;
      return (
        <span key={s} className="dish-card-season-badge">
          {seasonObj.icon} {seasonObj.label}
        </span>
      );
    });
  };

  const isFormValid =
    name.trim() !== "" && course !== null && selectedSeasons.length > 0;

  return (
    <div
      className={`edit-dish-page-container ${
        selectedDishId ? "has-selection" : ""
      }`}
    >
      <section className="master-panel">
        <header className="panel-header">
          <button
            className="back-btn"
            onClick={() => navigate("/")}
            aria-label="Retour"
          >
            <BackArrowIcon size={20} />
          </button>
          <h1 className="page-title">Modifier un plat</h1>
          <div className="header-spacer" />
        </header>

        <div className="search-and-filter-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Rechercher par nom ou ingrédient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="button"
            className={`toggle-filters-btn ${
              showFilters || activeFiltersCount > 0 ? "active" : ""
            }`}
            onClick={() => setShowFilters(!showFilters)}
            title="Afficher/masquer les filtres"
          >
            <FilterIcon size={27} />
            {activeFiltersCount > 0 && (
              <span className="filters-count-badge">{activeFiltersCount}</span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="filters-container">
            <div className="filter-group">
              <div className="filter-row">
                {DISH_TYPES.map(({ label, icon, course: c }) => {
                  const isSelected = filterTypes.includes(c);
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`filter-chip ${isSelected ? "active" : ""}`}
                      onClick={() => toggleFilterType(c)}
                    >
                      {icon} {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="filter-group">
              <div className="filter-row">
                {SEASONS.map(({ label, icon, season }) => {
                  const isSelected = filterSeasons.includes(season);
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`filter-chip ${isSelected ? "active" : ""}`}
                      onClick={() => toggleFilterSeason(season)}
                    >
                      {icon} {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="dishes-list">
          {filteredDishes.map((dish) => {
            const isSelected = dish.id === selectedDishId;
            const typeInfo = DISH_TYPES.find(
              (t) => t.course === (dish.course as Course),
            );

            return (
              <div
                key={dish.id}
                className={`dish-card ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelectDish(dish)}
              >
                <div className="dish-card-header">
                  <h3 className="dish-card-title">{dish.name}</h3>
                  <span className="dish-card-type-badge">
                    {typeInfo?.icon}{" "}
                    {COURSE_LABELS[dish.course as keyof typeof COURSE_LABELS]}
                  </span>
                </div>

                <div className="dish-card-seasons-row">
                  {renderSeasonsBadges(dish.seasons)}
                </div>

                {dish.description && (
                  <p className="dish-card-desc">{dish.description}</p>
                )}
              </div>
            );
          })}

          {filteredDishes.length === 0 && (
            <div className="empty-search-state">
              <p>Aucun plat ne correspond à vos critères.</p>
            </div>
          )}
        </div>
      </section>

      <section className="detail-panel">
        {selectedDish ? (
          <div className="edit-form-wrapper">
            <header className="panel-header detail-header">
              <button
                className="back-btn mobile-only-back"
                onClick={handleDeselectDish}
                aria-label="Retour à la liste"
              >
                <BackArrowIcon size={20} />
              </button>
              <h2 className="detail-title">Édition : {selectedDish.name}</h2>
              <button
                type="button"
                className="icon-delete-btn"
                onClick={() => setShowDeleteModal(true)}
                title="Supprimer ce plat"
              >
                <TrashIcon size={22} color="rgb(220, 57, 41)" />
              </button>
            </header>

            <form className="dish-form" onSubmit={handleSave}>
              <div className="input-group char-counter-field">
                <input
                  type="text"
                  className="modern-input name-input"
                  placeholder="Nom du plat"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_NAME_LENGTH}
                  required
                />
                <CharacterCounter value={name} maxLength={MAX_NAME_LENGTH} />
              </div>

              <div className="form-section-row">
                <div className="type-segmented-control">
                  {DISH_TYPES.map(({ label, icon, course: c }) => (
                    <button
                      type="button"
                      key={label}
                      className={`type-option ${course === c ? "active" : ""}`}
                      onClick={() =>
                        setCourse((prev) => (prev === c ? null : c))
                      }
                    >
                      <span className="type-icon">{icon}</span>
                      <span className="type-label">{label}</span>
                    </button>
                  ))}
                </div>

                <div className="seasons-group">
                  {SEASONS.map(({ label, icon, season }) => {
                    const isSelected = selectedSeasons.includes(season);
                    return (
                      <button
                        type="button"
                        key={label}
                        className={`season-chip ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleSeason(season)}
                      >
                        <span className="season-icon">{icon}</span>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="input-group char-counter-field">
                <textarea
                  className="modern-input description-input"
                  placeholder="Description, conseils de préparation ou ingrédients..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                />
                <CharacterCounter
                  value={description}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                />
              </div>

              <div className="action-buttons">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!isFormValid || saving}
                >
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="empty-detail-state">
            <div className="empty-icon">🍽️</div>
            <h3>Aucun plat sélectionné</h3>
            <p>
              Choisissez un plat dans la liste de gauche pour modifier ses
              ingrédients, sa saison ou sa catégorie.
            </p>
          </div>
        )}
      </section>

      {showDeleteModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteModal(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Supprimer le plat ?</h3>
            <p>Voulez-vous vraiment supprimer « {selectedDish?.name} » ?</p>
            <p>Cette action est irréversible.</p>
            <div className="modal-actions">
              <button
                className="btn btn-cancel-modal"
                onClick={() => setShowDeleteModal(false)}
              >
                Annuler
              </button>
              <button className="btn btn-delete-confirm" onClick={handleDelete}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditDishPage;
