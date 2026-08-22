import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "../pages/HomePage/HomePage";

beforeEach(() => {
  localStorage.clear();
});

describe("HomePage component", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(container).toBeTruthy();
  });

  it("displays all four menu items", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByText("Choisir les plats")).toBeTruthy();
    expect(screen.getByText("Ajouter un plat")).toBeTruthy();
    expect(screen.getByText("Modifier un plat")).toBeTruthy();
    expect(screen.getByText("Paramètres")).toBeTruthy();
  });

  it("renders the logo image", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    const logo = screen.getByAltText("Plat de la Semaine");
    expect(logo).toBeTruthy();
    expect(logo.tagName).toBe("IMG");
  });

  it("renders four card images with correct alt texts", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    const images = screen.getAllByRole("img");
    // logo + 4 menu cards
    expect(images.length).toBe(5);
    expect(screen.getByAltText("Choisir les plats")).toBeTruthy();
    expect(screen.getByAltText("Ajouter un plat")).toBeTruthy();
    expect(screen.getByAltText("Modifier un plat")).toBeTruthy();
    expect(screen.getByAltText("Paramètres")).toBeTruthy();
  });

  it("has the correct CSS class structure", () => {
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(container.querySelector(".app-container")).toBeTruthy();
    expect(container.querySelector(".menu-grid")).toBeTruthy();
    expect(container.querySelectorAll(".menu-card-wrapper").length).toBe(4);
    expect(container.querySelectorAll(".card-textbox-container").length).toBe(4);
  });

  it("renders menu cards as interactive buttons", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    const cards = screen.getAllByRole("button");
    expect(cards.length).toBe(5);
  });

  it("shows user info when logged in", () => {
    localStorage.setItem("user_id", "user-42");
    localStorage.setItem("user_username", "Mathéo");

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByText("Bonjour, Mathéo !")).toBeTruthy();
    expect(screen.getByText("Vos plats sont synchronisés")).toBeTruthy();
    expect(screen.getByText("Mon compte")).toBeTruthy();
  });
});
