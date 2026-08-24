import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import SettingsPage from "../pages/SettingsPage/SettingsPage";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderSettingsPage() {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects and displays the first tab by default on desktop", () => {
    renderSettingsPage();

    expect(
      screen.getByRole("heading", { name: "Profil utilisateur" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /mon compte/i }).className).toContain("active");
  });

  it("navigates to home when back is pressed on desktop", () => {
    renderSettingsPage();

    fireEvent.click(screen.getByRole("button", { name: "Retour" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("skips the mobile summary on desktop even when a tab is selected", () => {
    renderSettingsPage();

    fireEvent.click(
      screen.getByRole("button", { name: /signaler un bug/i }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Retour" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("returns to the summary first when a tab is selected on mobile", () => {
    mockMatchMedia(true);
    renderSettingsPage();

    fireEvent.click(
      screen.getByRole("button", { name: /données & plats/i }),
    );
    expect(
      screen.getByRole("heading", { name: "Données & Plats" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(
      screen.getByRole("heading", { name: "Paramètres" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });
});
