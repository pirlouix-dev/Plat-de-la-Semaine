import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MainMenu from "../MainMenu";

describe("MainMenu component", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );
    expect(container).toBeTruthy();
  });

  it("displays all four menu items", () => {
    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );
    expect(screen.getByText("Choisir le menu")).toBeTruthy();
    expect(screen.getByText("Ajouter un plat")).toBeTruthy();
    expect(screen.getByText("Modifier un plat")).toBeTruthy();
    expect(screen.getByText("Paramètres")).toBeTruthy();
  });

  it("renders the logo image", () => {
    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );
    const logo = screen.getByAltText("Plat de la Semaine");
    expect(logo).toBeTruthy();
    expect(logo.tagName).toBe("IMG");
  });

  it("renders four card images with correct alt texts", () => {
    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );
    const images = screen.getAllByRole("img");
    // logo + 4 menu cards
    expect(images.length).toBe(5);
    expect(screen.getByAltText("Choisir le menu")).toBeTruthy();
    expect(screen.getByAltText("Ajouter un plat")).toBeTruthy();
    expect(screen.getByAltText("Modifier un plat")).toBeTruthy();
    expect(screen.getByAltText("Paramètres")).toBeTruthy();
  });

  it("has the correct CSS class structure", () => {
    const { container } = render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );
    expect(container.querySelector(".app-container")).toBeTruthy();
    expect(container.querySelector(".menu-grid")).toBeTruthy();
    expect(container.querySelectorAll(".menu-card-wrapper").length).toBe(4);
    expect(container.querySelectorAll(".card-text-overlay").length).toBe(4);
  });

  it("renders menu cards as interactive buttons", () => {
    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>
    );
    const cards = screen.getAllByRole("button");
    expect(cards.length).toBe(4);
    expect(cards[0]).toHaveAttribute("tabindex", "0");
  });
});
