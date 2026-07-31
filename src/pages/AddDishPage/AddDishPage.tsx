import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon } from "../../components/Icons";
import { useDishes } from "../../hooks/useDishes";
import { Course, Season } from "../../types/dish";
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

function AddDishPage() {
  const navigate = useNavigate();
  const { addDish } = useDishes();

  const [name, setName] = useState("");
  const [dishType, setDishType] = useState<DishType>("Plat");
  const [selectedSeasons, setSelectedSeasons] = useState<Season[]>([]);
  const [description, setDescription] = useState("");

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

    const now = new Date().toISOString();
    const dish: DishDocType = {
      id: crypto.randomUUID(),
      serverId: "",
      name,
      description,
      course: typeEntry.course,
      seasons: selectedSeasons,
      updatedAt: now,
      isDeleted: false,
      syncStatus: "pending_create",
    };

    await addDish(dish);
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
        <div className="input-group">
          <input
            type="text"
            className="modern-input name-input"
            placeholder="Nom du plat"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-section-row">
          <div className="type-segmented-control">
            {DISH_TYPES.map(({ label, icon }) => (
              <button
                type="button"
                key={label}
                className={`type-option ${dishType === label ? "active" : ""}`}
                onClick={() => setDishType(label)}
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

        <div className="input-group">
          <textarea
            className="modern-input description-input"
            placeholder="Description, conseils de préparation ou ingrédients..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="action-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/")}
          >
            Quitter
          </button>
          <button type="submit" className="btn btn-primary">
            Sauvegarder
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddDishPage;
