import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ChooseDishesPage from "../pages/ChooseDishesPage/ChooseDishesPage";
import type { DishDocType } from "../db/schemas/dishes";

const STORAGE_KEY = "pdls_choose_menu_state_v2";

// ── Fixtures ──────────────────────────────────────────────────────────────────
// Date système figée au 21 août 2026 → été (Season.Summer = 1)

function makeDish(overrides: Partial<DishDocType> = {}): DishDocType {
  return {
    id: "d1",
    serverId: "",
    name: "Salade tomates & mozzarella",
    description: "Tomates, mozzarella, basilic",
    course: 0,
    seasons: [1],
    updatedAt: "2026-01-01T00:00:00Z",
    isDeleted: false,
    syncStatus: "synced",
    ...overrides,
  };
}

const SUMMER_DISH_A = makeDish({
  id: "summer-a",
  name: "Salade tomates & mozzarella",
  course: 0,
  seasons: [1],
});
const ALL_SEASONS_DISH = makeDish({
  id: "all-seasons",
  name: "Colin d'Alaska & riz",
  course: 1,
  seasons: [0, 1, 2, 3],
});
const WINTER_DISH = makeDish({
  id: "winter-only",
  name: "Soupe d'hiver",
  course: 1,
  seasons: [3],
});
const AUTUMN_DISH = makeDish({
  id: "autumn-only",
  name: "Tarte aux pommes",
  course: 2,
  seasons: [2, 3],
});

let mockDishes: DishDocType[] = [];

vi.mock("../hooks/useDishes", () => ({
  useDishes: () => ({
    dishes: mockDishes,
    isLoaded: true,
    addDish: vi.fn(),
    editDish: vi.fn(),
    removeDish: vi.fn(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <ChooseDishesPage />
    </MemoryRouter>,
  );
}

function getCurrentDishName(): string {
  const card = document.querySelector(".proposed-card-section");
  return card?.querySelector(".dish-name")?.textContent ?? "";
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function seedStorage(state: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-21T12:00:00"));
  // Fisher-Yates déterministe : échange toujours avec l'index 0
  vi.spyOn(Math, "random").mockReturnValue(0);
  localStorage.clear();
  mockDishes = [SUMMER_DISH_A, ALL_SEASONS_DISH];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ── Construction de la file ───────────────────────────────────────────────────

describe("ChooseDishesPage queue construction", () => {
  it("proposes only dishes in season for the current date", () => {
    mockDishes = [SUMMER_DISH_A, ALL_SEASONS_DISH, WINTER_DISH, AUTUMN_DISH];
    renderPage();

    const proposedNames: string[] = [];
    while (getCurrentDishName()) {
      proposedNames.push(getCurrentDishName());
      fireEvent.click(screen.getByText("✕ Refuser"));
      advance(220);
    }

    expect(proposedNames.sort()).toEqual([
      "Colin d'Alaska & riz",
      "Salade tomates & mozzarella",
    ]);
    expect(screen.getByText(/Plus aucun plat à passer en revue/)).toBeDefined();
  });

  it("shows a dedicated message when no dish is in season", () => {
    mockDishes = [WINTER_DISH, AUTUMN_DISH];
    renderPage();

    expect(
      screen.getByText(/Aucun plat de saison pour le moment/),
    ).toBeDefined();
  });

  it("shows a call to action when the database has no dishes", () => {
    mockDishes = [];
    renderPage();

    expect(screen.getByText("Aucun plat disponible.")).toBeDefined();
    expect(screen.getByText("Ajouter un plat")).toBeDefined();
  });
});

// ── Persistance (ids uniquement) ──────────────────────────────────────────────

describe("ChooseDishesPage persistence", () => {
  it("persists dish ids, not dish objects", () => {
    renderPage();

    fireEvent.click(screen.getByText("✓ Accepter"));
    advance(220);

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.selectedIds).toEqual(["all-seasons"]);
    expect(saved.queueIds).toEqual(["summer-a"]);
    expect(saved.history).toEqual([
      { action: "accept", dishId: "all-seasons" },
    ]);
  });

  it("restores a session from saved ids", () => {
    seedStorage({
      queueIds: ["summer-a"],
      selectedIds: [],
      history: [],
      mode: "editing",
    });
    renderPage();

    expect(getCurrentDishName()).toBe("Salade tomates & mozzarella");
  });

  it("drops ids of dishes deleted since the saved session", () => {
    seedStorage({
      queueIds: ["deleted-dish", "summer-a"],
      selectedIds: ["deleted-dish"],
      history: [{ action: "reject", dishId: "deleted-dish" }],
      mode: "editing",
    });
    renderPage();

    expect(getCurrentDishName()).toBe("Salade tomates & mozzarella");

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.queueIds).toEqual(["summer-a"]);
    expect(saved.selectedIds).toEqual([]);
    // L'historique est conservé pour préserver l'ordre des annulations ;
    // l'entrée orpheline sera ignorée lors du "Annuler".
    expect(saved.history).toEqual([
      { action: "reject", dishId: "deleted-dish" },
    ]);
  });

  it("rebuilds the queue from the database on reset", () => {
    renderPage();

    fireEvent.click(screen.getByText("✓ Accepter"));
    advance(220);
    fireEvent.click(screen.getByLabelText("Réinitialiser les plats"));
    fireEvent.click(screen.getByText("Oui, réinitialiser"));

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect([...saved.queueIds].sort()).toEqual(["all-seasons", "summer-a"]);
    expect(saved.selectedIds).toEqual([]);
    expect(saved.history).toEqual([]);
    expect(getCurrentDishName()).toBe("Colin d'Alaska & riz");
  });
});

// ── Annulation (undo) ─────────────────────────────────────────────────────────

describe("ChooseDishesPage undo", () => {
  it("restores an accepted dish as the proposed card", () => {
    renderPage();

    const firstName = getCurrentDishName();
    fireEvent.click(screen.getByText("✓ Accepter"));
    advance(220);

    expect(getCurrentDishName()).not.toBe(firstName);
    expect(screen.getByText("Plats sélectionnés (1)")).toBeDefined();

    fireEvent.click(screen.getByText("Annuler"));

    expect(getCurrentDishName()).toBe(firstName);
    expect(screen.getByText("Plats sélectionnés (0)")).toBeDefined();
  });

  it("restores a rejected dish as the proposed card", () => {
    renderPage();

    const firstName = getCurrentDishName();
    fireEvent.click(screen.getByText("✕ Refuser"));
    advance(220);

    expect(getCurrentDishName()).not.toBe(firstName);

    fireEvent.click(screen.getByText("Annuler"));

    expect(getCurrentDishName()).toBe(firstName);
  });

  it("blocks decisions while the undo animation plays", () => {
    renderPage();

    const firstName = getCurrentDishName();
    fireEvent.click(screen.getByText("✓ Accepter"));
    advance(220);
    fireEvent.click(screen.getByText("Annuler"));

    // Pendant l'animation de revert, les décisions sont ignorées
    fireEvent.click(screen.getByText("✕ Refuser"));
    advance(100);
    expect(getCurrentDishName()).toBe(firstName);

    advance(120);
    fireEvent.click(screen.getByText("✕ Refuser"));
    advance(220);
    expect(getCurrentDishName()).not.toBe(firstName);
  });

  it("ignores undo when the dish was deleted since the decision", () => {
    seedStorage({
      queueIds: ["summer-a"],
      selectedIds: ["ghost"],
      history: [{ action: "accept", dishId: "ghost" }],
      mode: "editing",
    });
    renderPage();

    expect(getCurrentDishName()).toBe("Salade tomates & mozzarella");

    fireEvent.click(screen.getByText("Annuler"));

    // L'action est retirée de l'historique mais le plat fantôme n'est
    // pas restauré dans la file.
    expect(getCurrentDishName()).toBe("Salade tomates & mozzarella");
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.history).toEqual([]);
    expect(saved.queueIds).toEqual(["summer-a"]);
  });
});
