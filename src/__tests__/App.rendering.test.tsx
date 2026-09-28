import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

describe("App component — rendering states", () => {
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
    expect(
      screen.getByText(/Failed to initialize database: IndexedDB unavailable/),
    ).toBeTruthy();
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
    expect(screen.getByText("Choisir les plats")).toBeTruthy();
  });
});
