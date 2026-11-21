import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon } from "../../components/Icons";
import CharacterCounter from "../../components/CharacterCounter";
import { useToast } from "../../components/toastContext";
import { useDishes } from "../../hooks/useDishes";
import {
  Course,
  Season,
  COURSE_LABEL_KEYS,
  SEASON_LABEL_KEYS,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  isValidCourse,
} from "../../types/dish";
import type { DishDocType } from "../../db/schemas/dishes";
import { useTranslation } from "../../i18n";
import "./AddDishPage.css";

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

const DRAFT_KEY = "add-dish-draft";
const DRAFT_SAVE_DELAY_MS = 400;

type DishDraft = {
  name: string;
  dishCourse: Course | null;
  selectedSeasons: Season[];
  description: string;
};

const EMPTY_DRAFT: DishDraft = {
  name: "",
  dishCourse: null,
  selectedSeasons: [],
  description: "",
};

/** Drafts written before the labels were localised stored the French label. */
const LEGACY_COURSE_LABELS: Record<string, Course> = {
  Entrée: Course.Starter,
  Plat: Course.Main,
  Dessert: Course.Dessert,
};

function parseDraftCourse(value: unknown): Course | null {
  if (typeof value === "number" && isValidCourse(value)) return value;
  if (typeof value === "string" && value in LEGACY_COURSE_LABELS) {
    return LEGACY_COURSE_LABELS[value];
  }
  return null;
}

function loadDraft(): DishDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<DishDraft>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      dishCourse: parseDraftCourse(parsed.dishCourse),
      selectedSeasons: Array.isArray(parsed.selectedSeasons)
        ? parsed.selectedSeasons.filter(
            (s): s is Season =>
              typeof s === "number" &&
              SEASONS.some(({ season }) => season === s),
          )
        : [],
      description:
        typeof parsed.description === "string" ? parsed.description : "",
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

function isEmptyDraft(draft: DishDraft): boolean {
  return (
    draft.name === "" &&
    draft.dishCourse === null &&
    draft.selectedSeasons.length === 0 &&
    draft.description === ""
  );
}

function AddDishPage() {
  const navigate = useNavigate();
  const { addDish } = useDishes();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [initialDraft] = useState(loadDraft);
  const [name, setName] = useState(initialDraft.name);
  const [dishCourse, setDishCourse] = useState<Course | null>(
    initialDraft.dishCourse,
  );
  const [selectedSeasons, setSelectedSeasons] = useState<Season[]>(
    initialDraft.selectedSeasons,
  );
  const [description, setDescription] = useState(initialDraft.description);

  const isFormValid =
    name.trim() !== "" && dishCourse !== null && selectedSeasons.length > 0;

  useEffect(() => {
    const draft: DishDraft = { name, dishCourse, selectedSeasons, description };
    const timer = setTimeout(() => {
      if (isEmptyDraft(draft)) {
        localStorage.removeItem(DRAFT_KEY);
      } else {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [name, dishCourse, selectedSeasons, description]);

  const resetForm = () => {
    setName(EMPTY_DRAFT.name);
    setDishCourse(EMPTY_DRAFT.dishCourse);
    setSelectedSeasons([...EMPTY_DRAFT.selectedSeasons]);
    setDescription(EMPTY_DRAFT.description);
  };

  const toggleSeason = (season: Season) => {
    setSelectedSeasons((prev) =>
      prev.includes(season)
        ? prev.filter((s) => s !== season)
        : [...prev, season],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dishCourse === null) return;

    const now = new Date().toISOString();
    const dish: DishDocType = {
      id: crypto.randomUUID(),
      serverId: "",
      name,
      description,
      course: dishCourse,
      seasons: selectedSeasons,
      updatedAt: now,
      isDeleted: false,
      syncStatus: "pending_create",
    };

    try {
      await addDish(dish);
      localStorage.removeItem(DRAFT_KEY);
      resetForm();
      showToast(t("add.success"), "success");
    } catch {
      showToast(t("add.error"), "error");
    }
  };

  return (
    <div className="create-dish-container">
      <header className="form-header">
        <button
          className="back-btn"
          onClick={() => navigate("/")}
          aria-label={t("common.back")}
        >
          <BackArrowIcon size={20} />
        </button>
        <h1 className="page-title">{t("add.title")}</h1>
        <div className="header-spacer" />
      </header>

      <form className="dish-form" onSubmit={handleSubmit}>
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
            {DISH_COURSES.map(({ icon, course }) => {
              const label = t(COURSE_LABEL_KEYS[course]);
              return (
                <button
                  type="button"
                  key={course}
                  className={`course-option ${dishCourse === course ? "active" : ""}`}
                  onClick={() =>
                    setDishCourse((prev) => (prev === course ? null : course))
                  }
                >
                  <span className="course-icon">{icon}</span>
                  <span className="course-label">{label}</span>
                </button>
              );
            })}
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
            disabled={!isFormValid}
          >
            {t("add.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddDishPage;
