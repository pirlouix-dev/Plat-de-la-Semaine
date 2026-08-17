import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon } from "../../components/Icons";
import CharacterCounter from "../../components/CharacterCounter";
import {
  Course,
  Season,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from "../../types/dish";
import "./EditDishPage.css";

type DishType = "Entrée" | "Plat" | "Dessert";

interface MockDish {
  id: string;
  name: string;
  dishType: DishType;
  selectedSeasons: Season[];
  description: string;
}

const DISH_TYPES: { label: DishType; icon: string; course: Course }[] = [
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

const INITIAL_MOCK_DISHES: MockDish[] = [
  {
    id: "1",
    name: "Colin d'Alaska & riz",
    dishType: "Plat",
    selectedSeasons: [
      Season.Spring,
      Season.Summer,
      Season.Autumn,
      Season.Winter,
    ],
    description: "Colin d'Alaska, riz à la vapeur",
  },
  {
    id: "2",
    name: "Courgette & semoule",
    dishType: "Plat",
    selectedSeasons: [
      Season.Spring,
      Season.Summer,
      Season.Autumn,
      Season.Winter,
    ],
    description: "Courgettes poêlées, Semoule, Sauce soja",
  },
  {
    id: "3",
    name: "Crevettes & riz",
    dishType: "Plat",
    selectedSeasons: [Season.Summer, Season.Spring],
    description: "Crevettes sautées, Riz basmati",
  },
  {
    id: "4",
    name: "Falafels & semoule",
    dishType: "Entrée",
    selectedSeasons: [Season.Autumn, Season.Winter],
    description: "Falafels de pois chiches, Semoule épicée",
  },
  {
    id: "5",
    name: "Galettes bretonnes",
    dishType: "Plat",
    selectedSeasons: [
      Season.Spring,
      Season.Summer,
      Season.Autumn,
      Season.Winter,
    ],
    description: "Galettes, Beurre, Œufs, Gruyère râpé, Jambon",
  },
];

function EditDishPage() {
  const navigate = useNavigate();
  const [dishes, setDishes] = useState<MockDish[]>(INITIAL_MOCK_DISHES);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);

  // Recherche et filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterTypes, setFilterTypes] = useState<DishType[]>([]);
  const [filterSeasons, setFilterSeasons] = useState<Season[]>([]);

  // Modale de confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Formulaire d'édition
  const selectedDish = dishes.find((d) => d.id === selectedDishId) || null;
  const [name, setName] = useState("");
  const [dishType, setDishType] = useState<DishType | null>(null);
  const [selectedSeasons, setSelectedSeasons] = useState<Season[]>([]);
  const [description, setDescription] = useState("");

  const handleSelectDish = (dish: MockDish) => {
    setSelectedDishId(dish.id);
    setName(dish.name);
    setDishType(dish.dishType);
    setSelectedSeasons(dish.selectedSeasons);
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

  // Toggle filtres multiples
  const toggleFilterType = (type: DishType) => {
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

  // Recherche + Filtrage multiple
  const filteredDishes = dishes.filter((dish) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === "" ||
      dish.name.toLowerCase().includes(q) ||
      dish.description.toLowerCase().includes(q);

    const matchesType =
      filterTypes.length === 0 || filterTypes.includes(dish.dishType);

    const matchesSeason =
      filterSeasons.length === 0 ||
      dish.selectedSeasons.some((s) => filterSeasons.includes(s));

    return matchesSearch && matchesType && matchesSeason;
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDishId) return;

    setDishes((prev) =>
      prev.map((dish) =>
        dish.id === selectedDishId
          ? {
              ...dish,
              name,
              dishType: dishType || "Plat",
              selectedSeasons,
              description,
            }
          : dish,
      ),
    );
  };

  const handleDelete = () => {
    if (!selectedDishId) return;
    setDishes((prev) => prev.filter((d) => d.id !== selectedDishId));
    setSelectedDishId(null);
    setShowDeleteModal(false);
  };

  // Badges des saisons sur la carte
  const renderSeasonsBadges = (dishSeasons: Season[]) => {
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
    name.trim() !== "" && dishType !== null && selectedSeasons.length > 0;

  return (
    <div
      className={`edit-dish-page-container ${
        selectedDishId ? "has-selection" : ""
      }`}
    >
      {/* --- PANNEAU GAUCHE : LISTE & FILTRES (MASTER) --- */}
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

        {/* Recherche et bouton Filtres */}
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
            <span>🎛️</span>
            {activeFiltersCount > 0 && (
              <span className="filters-count-badge">{activeFiltersCount}</span>
            )}
          </button>
        </div>

        {/* Filtres avancés rétractables */}
        {showFilters && (
          <div className="filters-container">
            <div className="filter-group">
              <span className="filter-group-label">Types</span>
              <div className="filter-row">
                {DISH_TYPES.map(({ label, icon }) => {
                  const isSelected = filterTypes.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`filter-chip ${isSelected ? "active" : ""}`}
                      onClick={() => toggleFilterType(label)}
                    >
                      {icon} {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-group-label">Saisons</span>
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

        {/* Liste scrollable des cartes */}
        <div className="dishes-list">
          {filteredDishes.map((dish) => {
            const isSelected = dish.id === selectedDishId;
            const typeInfo = DISH_TYPES.find((t) => t.label === dish.dishType);

            return (
              <div
                key={dish.id}
                className={`dish-card ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelectDish(dish)}
              >
                <div className="dish-card-header">
                  <h3 className="dish-card-title">{dish.name}</h3>
                  <span className="dish-card-type-badge">
                    {typeInfo?.icon} {dish.dishType}
                  </span>
                </div>

                <div className="dish-card-seasons-row">
                  {renderSeasonsBadges(dish.selectedSeasons)}
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

      {/* --- PANNEAU DROIT : FORMULAIRE D'ÉDITION (DETAIL) --- */}
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
                🗑️
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
                  {DISH_TYPES.map(({ label, icon }) => (
                    <button
                      type="button"
                      key={label}
                      className={`type-option ${dishType === label ? "active" : ""}`}
                      onClick={() =>
                        setDishType((prev) => (prev === label ? null : label))
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
                  disabled={!isFormValid}
                >
                  Sauvegarder
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

      {/* --- MODALE DE CONFIRMATION DE SUPPRESSION --- */}
      {showDeleteModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteModal(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Supprimer le plat ?</h3>
            <p>
              Voulez-vous vraiment supprimer « {selectedDish?.name} » ? Cette
              action est irréversible.
            </p>
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
