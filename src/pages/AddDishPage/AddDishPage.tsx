import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon } from "../../components/Icons";
import CharacterCounter from "../../components/CharacterCounter";
import { useDishes } from "../../hooks/useDishes";
import {
  Course,
  Season,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from "../../types/dish";
import type { DishDocType } from "../../db/schemas/dishes";
import "./AddDishPage.css";

type DishType = "Entrée" | "Plat" | "Dessert";

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

const DRAFT_KEY = "add-dish-draft";
const DRAFT_SAVE_DELAY_MS = 400;

type DishDraft = {
  name: string;
  dishType: DishType | null;
  selectedSeasons: Season[];
  description: string;
};

const EMPTY_DRAFT: DishDraft = {
  name: "",
  dishType: null,
  selectedSeasons: [],
  description: "",
};

function loadDraft(): DishDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<DishDraft>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      dishType: DISH_TYPES.some((t) => t.label === parsed.dishType)
        ? (parsed.dishType as DishType)
        : null,
      selectedSeasons: Array.isArray(parsed.selectedSeasons)
        ? parsed.selectedSeasons.filter(
            (s): s is Season =>
              typeof s === "number" && SEASONS.some(({ season }) => season === s),
          )
        : [],
      description: typeof parsed.description === "string" ? parsed.description : "",
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

function isEmptyDraft(draft: DishDraft): boolean {
  return (
    draft.name === "" &&
    draft.dishType === null &&
    draft.selectedSeasons.length === 0 &&
    draft.description === ""
  );
}

function AddDishPage() {
  const navigate = useNavigate();
  const { addDish } = useDishes();

  const [initialDraft] = useState(loadDraft);
  const [name, setName] = useState(initialDraft.name);
  const [dishType, setDishType] = useState<DishType | null>(initialDraft.dishType);
  const [selectedSeasons, setSelectedSeasons] = useState<Season[]>(
    initialDraft.selectedSeasons,
  );
  const [description, setDescription] = useState(initialDraft.description);

  const isFormValid = name.trim() !== "" && dishType !== null && selectedSeasons.length > 0;

  useEffect(() => {
    const draft: DishDraft = { name, dishType, selectedSeasons, description };
    const timer = setTimeout(() => {
      if (isEmptyDraft(draft)) {
        localStorage.removeItem(DRAFT_KEY);
      } else {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [name, dishType, selectedSeasons, description]);

  const toggleSeason = (season: Season) => {
    setSelectedSeasons((prev) =>
      prev.includes(season)
        ? prev.filter((s) => s !== season)
        : [...prev, season],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const typeEntry = DISH_TYPES.find((t) => t.label === dishType);
    if (!typeEntry) return;
    const course = typeEntry.course;

    const now = new Date().toISOString();
    const dish: DishDocType = {
      id: crypto.randomUUID(),
      serverId: "",
      name,
      description,
      course,
      seasons: selectedSeasons,
      updatedAt: now,
      isDeleted: false,
      syncStatus: "pending_create",
    };

    await addDish(dish);
    localStorage.removeItem(DRAFT_KEY);
    navigate("/");
  };

  return (
    <div className="create-dish-container">
      <header className="form-header">
        <button
          className="back-btn"
          onClick={() => navigate("/")}
          aria-label="Retour"
        >
          <BackArrowIcon size={20} />
        </button>
        <h1 className="page-title">Ajouter un plat</h1>
        <div className="header-spacer" />
      </header>

      <form className="dish-form" onSubmit={handleSubmit}>
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
          <CharacterCounter value={description} maxLength={MAX_DESCRIPTION_LENGTH} />
        </div>

        <div className="action-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/")}
          >
            Quitter
          </button>
          <button type="submit" className="btn btn-primary" disabled={!isFormValid}>
            Sauvegarder
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddDishPage;
