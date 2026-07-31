import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const storage: Record<string, string> = {};

describe("App component — rendering states", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.keys(storage).forEach((k) => delete storage[k]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
      get length() { return Object.keys(storage).length; },
      key: (i: number) => Object.keys(storage)[i] ?? null,
    });
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
    expect(
      screen.getByText(/Failed to initialize database: IndexedDB unavailable/),
    ).toBeTruthy();
  });

  it("renders MainMenuPage when database is ready", async () => {
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
    expect(screen.getByText("Choisir le menu")).toBeTruthy();
  });
});
