import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ChooseMenuPage from "../pages/ChooseMenuPage/ChooseMenuPage";

const STORAGE_KEY = "pdls_choose_menu_state_v1";

function renderPage() {
  return render(
    <MemoryRouter>
      <ChooseMenuPage />
    </MemoryRouter>,
  );
}

function getCurrentDishName(): string {
  const card = document.querySelector(".proposed-card-section");
  return card?.querySelector(".dish-name")?.textContent ?? "";
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ChooseMenuPage undo", () => {
  it("restores an accepted dish as the proposed card", () => {
    renderPage();

    const firstName = getCurrentDishName();
    fireEvent.click(screen.getByText("✓ Accepter"));
    act(() => vi.advanceTimersByTime(220));

    expect(getCurrentDishName()).not.toBe(firstName);
    expect(screen.getByText("Menu sélectionné (1)")).toBeDefined();

    fireEvent.click(screen.getByText("Annuler"));

    expect(getCurrentDishName()).toBe(firstName);
    expect(screen.getByText("Menu sélectionné (0)")).toBeDefined();
  });

  it("restores a rejected dish as the proposed card", () => {
    renderPage();

    const firstName = getCurrentDishName();
    fireEvent.click(screen.getByText("✕ Refuser"));
    act(() => vi.advanceTimersByTime(220));

    expect(getCurrentDishName()).not.toBe(firstName);

    fireEvent.click(screen.getByText("Annuler"));

    expect(getCurrentDishName()).toBe(firstName);
  });

  it("blocks decisions while the undo animation plays", () => {
    renderPage();

    const firstName = getCurrentDishName();
    fireEvent.click(screen.getByText("✓ Accepter"));
    act(() => vi.advanceTimersByTime(220));
    fireEvent.click(screen.getByText("Annuler"));

    // Pendant l'animation de revert, les décisions sont ignorées
    fireEvent.click(screen.getByText("✕ Refuser"));
    act(() => vi.advanceTimersByTime(100));
    expect(getCurrentDishName()).toBe(firstName);

    act(() => vi.advanceTimersByTime(120));
    fireEvent.click(screen.getByText("✕ Refuser"));
    act(() => vi.advanceTimersByTime(220));
    expect(getCurrentDishName()).not.toBe(firstName);
  });

  it("persists the restored queue to localStorage", () => {
    renderPage();

    const firstName = getCurrentDishName();
    fireEvent.click(screen.getByText("✓ Accepter"));
    act(() => vi.advanceTimersByTime(220));
    fireEvent.click(screen.getByText("Annuler"));
    act(() => vi.advanceTimersByTime(220));

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.queue[0].name).toBe(firstName);
    expect(saved.selectedDishes).toHaveLength(0);
    expect(saved.history).toHaveLength(0);
  });
});
