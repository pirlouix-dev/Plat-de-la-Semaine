import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "../pages/HomePage/HomePage";
import { useSyncStatus } from "../hooks/useSyncStatus";
import type { SyncDisplay } from "../hooks/useSyncStatus";

vi.mock("../hooks/useSyncStatus", () => ({
  useSyncStatus: vi.fn(),
}));

const mockUseSyncStatus = vi.mocked(useSyncStatus);

function mockSyncStatus(overrides: Partial<SyncDisplay> = {}): void {
  mockUseSyncStatus.mockReturnValue({
    text: "Vos plats sont synchronisés • il y a 5 min",
    isError: false,
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
  mockSyncStatus();
});

describe("HomePage component", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });

  it("displays all four menu items", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
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
      </MemoryRouter>,
    );
    const logo = screen.getByAltText("Plat de la Semaine");
    expect(logo).toBeTruthy();
    expect(logo.tagName).toBe("IMG");
  });

  it("renders four card images with correct alt texts", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
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
      </MemoryRouter>,
    );
    expect(container.querySelector(".app-container")).toBeTruthy();
    expect(container.querySelector(".menu-grid")).toBeTruthy();
    expect(container.querySelectorAll(".menu-card-wrapper").length).toBe(4);
    expect(container.querySelectorAll(".card-textbox-container").length).toBe(
      4,
    );
  });

  it("renders menu cards as interactive buttons", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
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
      </MemoryRouter>,
    );
    expect(screen.getByText("Bonjour, Mathéo !")).toBeTruthy();
    expect(
      screen.getByText("Vos plats sont synchronisés • il y a 5 min"),
    ).toBeTruthy();
    expect(screen.getByText("Mon compte")).toBeTruthy();
  });

  it("shows the syncing message while a sync is running", () => {
    localStorage.setItem("user_id", "user-42");
    mockSyncStatus({ text: "Synchronisation en cours…", isError: false });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Synchronisation en cours…")).toBeTruthy();
  });

  it("shows the offline message in red when offline", () => {
    localStorage.setItem("user_id", "user-42");
    mockSyncStatus({
      text: "Vous êtes hors ligne • synchronisation impossible",
      isError: true,
    });

    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/hors ligne/)).toBeTruthy();
    expect(container.querySelector(".account-subtitle--error")).toBeTruthy();
  });

  it("shows the sync error message in red when the last sync failed", () => {
    localStorage.setItem("user_id", "user-42");
    mockSyncStatus({
      text: "Échec de la synchronisation • Tentative n°3",
      isError: true,
    });

    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Tentative n°3/)).toBeTruthy();
    expect(container.querySelector(".account-subtitle--error")).toBeTruthy();
  });

  it("keeps the guest subtitle regardless of sync state", () => {
    mockSyncStatus({ text: "Synchronisation en cours…", isError: false });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("Connectez-vous pour sauvegarder vos plats"),
    ).toBeTruthy();
  });
});
