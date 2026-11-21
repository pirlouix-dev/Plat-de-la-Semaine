import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon, FilterIcon, TrashIcon } from "../../components/Icons";
import CharacterCounter from "../../components/CharacterCounter";
import { ExpandableDescription } from "../../components/ExpandableDescription";
import { useToast } from "../../components/toastContext";
import { useDishes } from "../../hooks/useDishes";
import type { DishDocType } from "../../db/schemas/dishes";
import {
  Course,
  Season,
  COURSE_LABEL_KEYS,
  SEASON_LABEL_KEYS,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from "../../types/dish";
import { useTranslation } from "../../i18n";
import "./EditDishPage.css";

const DISH_COURSES: { icon: string; course: Course }[] = [
  { icon: "🥗", course: Course.Starter },
  { icon: "🍽️", course: Course.Main },
  { icon: "🍰", course: Course.Dessert },
];

const SEASONS: { icon: string; season: Season }[] = [
  { icon: "🌱", season: Season.Spring },
  { icon: "☀️", season: Season.Summer },
  { icon: "🍂", season: Season.Autumn },
  { icon: "❄️", season: Season.Winter },
];

function EditDishPage() {
  const navigate = useNavigate();
  const { dishes, editDish, removeDish } = useDishes();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterCourses, setFilterCourses] = useState<Course[]>([]);
  const [filterSeasons, setFilterSeasons] = useState<Season[]>([]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedDishIds, setExpandedDishIds] = useState<
    Record<string, boolean>
  >({});

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

  const toggleExpand = (dishId: string) => {
    setExpandedDishIds((prev) => ({
      ...prev,
      [dishId]: !prev[dishId],
    }));
  };

  const toggleSeason = (season: Season) => {
    setSelectedSeasons((prev) =>
      prev.includes(season)
        ? prev.filter((s) => s !== season)
        : [...prev, season],
    );
  };

  const toggleFilterCourse = (c: Course) => {
    setFilterCourses((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const toggleFilterSeason = (season: Season) => {
    setFilterSeasons((prev) =>
      prev.includes(season)
        ? prev.filter((x) => x !== season)
        : [...prev, season],
    );
  };

  const activeFiltersCount = filterCourses.length + filterSeasons.length;

  const filteredDishes = dishes.filter((dish) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === "" ||
      dish.name.toLowerCase().includes(q) ||
      dish.description.toLowerCase().includes(q);

    const matchesCourse =
      filterCourses.length === 0 ||
      filterCourses.includes(dish.course as Course);

    const matchesSeason =
      filterSeasons.length === 0 ||
      dish.seasons.some((s) => filterSeasons.includes(s as Season));

    return matchesSearch && matchesCourse && matchesSeason;
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
      showToast(t("edit.saveSuccess"), "success");
    } catch {
      showToast(t("edit.saveError"), "error");
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
      showToast(t("edit.deleteSuccess"), "success");
    } catch {
      showToast(t("edit.deleteError"), "error");
    }
  };

  const renderSeasonsBadges = (dishSeasons: number[]) => {
    if (dishSeasons.length === SEASONS.length) {
      return (
        <span className="dish-card-season-badge">
          🗓️ {t("common.allSeasons")}
        </span>
      );
    }

    return dishSeasons.map((s) => {
      const seasonObj = SEASONS.find((item) => item.season === s);
      if (!seasonObj) return null;
      return (
        <span key={s} className="dish-card-season-badge">
          {seasonObj.icon} {t(SEASON_LABEL_KEYS[seasonObj.season])}
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
            aria-label={t("common.back")}
          >
            <BackArrowIcon size={20} />
          </button>
          <h1 className="page-title">{t("edit.title")}</h1>
          <div className="header-spacer" />
        </header>

        <div className="search-and-filter-bar">
          <input
            type="text"
            className="search-input"
            placeholder={t("edit.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="button"
            className={`toggle-filters-btn ${
              showFilters || activeFiltersCount > 0 ? "active" : ""
            }`}
            onClick={() => setShowFilters(!showFilters)}
            title={t("edit.toggleFilters")}
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
                {DISH_COURSES.map(({ icon, course: c }) => {
                  const isSelected = filterCourses.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`filter-chip ${isSelected ? "active" : ""}`}
                      onClick={() => toggleFilterCourse(c)}
                    >
                      {icon} {t(COURSE_LABEL_KEYS[c])}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="filter-group">
              <div className="filter-row">
                {SEASONS.map(({ icon, season }) => {
                  const isSelected = filterSeasons.includes(season);
                  return (
                    <button
                      key={season}
                      type="button"
                      className={`filter-chip ${isSelected ? "active" : ""}`}
                      onClick={() => toggleFilterSeason(season)}
                    >
                      {icon} {t(SEASON_LABEL_KEYS[season])}
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
            const courseInfo = DISH_COURSES.find(
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
                  <span className="dish-card-course-badge">
                    {courseInfo?.icon}{" "}
                    {t(COURSE_LABEL_KEYS[dish.course as Course])}
                  </span>
                </div>

                <div className="dish-card-seasons-row">
                  {renderSeasonsBadges(dish.seasons)}
                </div>

                <ExpandableDescription
                  description={dish.description}
                  descriptionClassName="dish-card-desc"
                  expanded={!!expandedDishIds[dish.id]}
                  onToggle={() => toggleExpand(dish.id)}
                />
              </div>
            );
          })}

          {filteredDishes.length === 0 && (
            <div className="empty-search-state">
              <p>{t("edit.noResults")}</p>
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
                aria-label={t("edit.backToList")}
              >
                <BackArrowIcon size={20} />
              </button>
              <h2 className="detail-title">
                {t("edit.detailTitle", { name: selectedDish.name })}
              </h2>
              <button
                type="button"
                className="icon-delete-btn"
                onClick={() => setShowDeleteModal(true)}
                title={t("edit.deleteDish")}
              >
                <TrashIcon size={22} color="rgb(220, 57, 41)" />
              </button>
            </header>

            <form className="dish-form" onSubmit={handleSave}>
              <div className="input-group char-counter-field">
                <input
                  type="text"
                  className="modern-input name-input"
                  placeholder={t("add.name")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_NAME_LENGTH}
                  required
                />
                <CharacterCounter value={name} maxLength={MAX_NAME_LENGTH} />
              </div>

              <div className="form-section-row">
                <div className="course-segmented-control">
                  {DISH_COURSES.map(({ icon, course: c }) => (
                    <button
                      type="button"
                      key={c}
                      className={`course-option ${course === c ? "active" : ""}`}
                      onClick={() =>
                        setCourse((prev) => (prev === c ? null : c))
                      }
                    >
                      <span className="course-icon">{icon}</span>
                      <span className="course-label">
                        {t(COURSE_LABEL_KEYS[c])}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="seasons-group">
                  {SEASONS.map(({ icon, season }) => {
                    const isSelected = selectedSeasons.includes(season);
                    return (
                      <button
                        type="button"
                        key={season}
                        className={`season-chip ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleSeason(season)}
                      >
                        <span className="season-icon">{icon}</span>
                        <span>{t(SEASON_LABEL_KEYS[season])}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="input-group char-counter-field">
                <textarea
                  className="modern-input description-input"
                  placeholder={t("add.description")}
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
                  {saving ? t("edit.saving") : t("edit.save")}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="empty-detail-state">
            <div className="empty-icon">🍽️</div>
            <h3>{t("edit.noSelectionTitle")}</h3>
            <p>{t("edit.noSelectionHint")}</p>
          </div>
        )}
      </section>

      {showDeleteModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteModal(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{t("edit.deleteTitle")}</h3>
            <p>
              {t("edit.deleteConfirm", { name: selectedDish?.name ?? "" })}
            </p>
            <p>{t("edit.irreversible")}</p>
            <div className="modal-actions">
              <button
                className="btn btn-cancel-modal"
                onClick={() => setShowDeleteModal(false)}
              >
                {t("common.cancel")}
              </button>
              <button className="btn btn-delete-confirm" onClick={handleDelete}>
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditDishPage;
