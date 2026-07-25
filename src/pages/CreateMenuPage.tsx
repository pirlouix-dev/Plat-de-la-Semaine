import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon } from "../components/Icons";
import "./CreateMenuPage.css";

type DishType = "Entrée" | "Plat" | "Dessert";

const DISH_TYPES: { label: DishType; icon: string }[] = [
  { label: "Entrée", icon: "🥗" },
  { label: "Plat", icon: "🍽️" },
  { label: "Dessert", icon: "🍰" },
];

const SEASONS = [
  { id: "Printemps", label: "Printemps", icon: "🌱" },
  { id: "Été", label: "Été", icon: "☀️" },
  { id: "Automne", label: "Automne", icon: "🍂" },
  { id: "Hiver", label: "Hiver", icon: "❄️" },
];

function CreateMenuPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [dishType, setDishType] = useState<DishType>("Plat");
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  const toggleSeason = (seasonId: string) => {
    setSelectedSeasons((prev) =>
      prev.includes(seasonId)
        ? prev.filter((s) => s !== seasonId)
        : [...prev, seasonId],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ name, dishType, selectedSeasons, description });
    // Logique de sauvegarde
  };

  return (
    <div className="create-dish-container">
      {/* En-tête */}
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
        {/* Champ Nom du plat */}
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

        {/* Section Sélecteurs (Type & Saisons) */}
        <div className="form-section-row">
          {/* Sélecteur de Type (Segmented control) */}
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

          {/* Sélecteur des Saisons */}
          <div className="seasons-group">
            {SEASONS.map(({ id, label, icon }) => {
              const isSelected = selectedSeasons.includes(id);
              return (
                <button
                  type="button"
                  key={id}
                  className={`season-chip ${isSelected ? "selected" : ""}`}
                  onClick={() => toggleSeason(id)}
                >
                  <span className="season-icon">{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Champ Description */}
        <div className="input-group">
          <textarea
            className="modern-input description-input"
            placeholder="Description, conseils de préparation ou ingrédients..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Boutons d'action */}
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

export default CreateMenuPage;
