import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createTranslator } from "../i18n";

const t = createTranslator("en");

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

// Each test re-imports the whole app graph after resetModules; give the suite
// more headroom than the 5s default so it doesn't need to run in isolation.
describe("App component — rendering states", { timeout: 15_000 }, () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("renders routes immediately while database initializes", async () => {
    vi.doMock("../db/DatabaseContext", () => ({
      DatabaseProvider: ({ children }: { children: React.ReactNode }) =>
        children,
      useDatabase: () => ({ db: null, isLoading: true, error: null }),
    }));

    const { default: MockApp } = await import("../App");
    render(
      <MemoryRouter>
        <MockApp />
      </MemoryRouter>,
    );
    expect(screen.getByAltText("Plat de la Semaine")).toBeTruthy();
  });

  it("shows error state when database fails", async () => {
    vi.doMock("../db/DatabaseContext", () => ({
      DatabaseProvider: ({ children }: { children: React.ReactNode }) =>
        children,
      useDatabase: () => ({
        db: null,
        isLoading: false,
        error: "IndexedDB unavailable",
      }),
    }));

    const { default: MockApp } = await import("../App");
    render(
      <MemoryRouter>
        <MockApp />
      </MemoryRouter>,
    );
    expect(screen.getByText(t("app.databaseError"))).toBeTruthy();
    expect(screen.queryByText(/IndexedDB unavailable/)).toBeNull();
  });

  it("renders HomePage when database is ready", async () => {
    vi.doMock("../db/DatabaseContext", () => ({
      DatabaseProvider: ({ children }: { children: React.ReactNode }) =>
        children,
      useDatabase: () => ({
        db: {
          name: "dishes",
        } as unknown as import("../db/DatabaseContext").AppDatabase,
        isLoading: false,
        error: null,
      }),
    }));

    const { default: MockApp } = await import("../App");
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MockApp />
      </MemoryRouter>,
    );
    expect(screen.getByText(t("home.menu.choose"))).toBeTruthy();
  });

  it.each(["/logni", "/foo/bar"])(
    "redirects unknown path %s to the main menu",
    async (path) => {
      vi.doMock("../db/DatabaseContext", () => ({
        DatabaseProvider: ({ children }: { children: React.ReactNode }) =>
          children,
        useDatabase: () => ({
          db: {
            name: "dishes",
          } as unknown as import("../db/DatabaseContext").AppDatabase,
          isLoading: false,
          error: null,
        }),
      }));

      const { default: MockApp } = await import("../App");
      render(
        <MemoryRouter initialEntries={[path]}>
          <MockApp />
          <LocationProbe />
        </MemoryRouter>,
      );

      expect(screen.getByText(t("home.menu.choose"))).toBeTruthy();
      expect(screen.getByTestId("pathname").textContent).toBe("/");
    },
  );
});
