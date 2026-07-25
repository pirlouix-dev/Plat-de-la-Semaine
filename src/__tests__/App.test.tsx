import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Static code checks (file content) ─────────────────────────────────────────

describe("App.tsx — dead code removed (issue #2)", () => {
  const appPath = resolve(__dirname, "../App.tsx");
  const content = readFileSync(appPath, "utf-8");

  it("should not contain the fetchHelloMessage function", () => {
    expect(content).not.toMatch(/fetchHelloMessage/);
  });

  it("should not contain the ApiResponse interface", () => {
    expect(content).not.toMatch(/interface ApiResponse/);
  });

  it("should not contain the AI instruction comment", () => {
    expect(content).not.toMatch(/GEMINI INSTRUCTION/);
  });

  it("should not contain unused useState for setMessage or setError", () => {
    expect(content).not.toMatch(/\bsetMessage\b/);
    expect(content).not.toMatch(/\bsetError\b/);
  });

  it("should not import useState (no longer needed)", () => {
    expect(content).not.toMatch(/\buseState\b/);
  });

  it("should not have top-level await for database creation", () => {
    expect(content).not.toMatch(/await createRxDatabase/);
    expect(content).not.toMatch(/top-level await/);
  });

  it("should use DatabaseProvider to wrap the app", () => {
    expect(content).toMatch(/DatabaseProvider/);
    expect(content).toMatch(/<DatabaseProvider>/);
  });

  it("should render MainMenu as the home route", () => {
    expect(content).toMatch(/<MainMenu\s*\/>/);
  });

  it("should export App as default", () => {
    expect(content).toMatch(/export default App/);
  });
});

// ── Routing checks ────────────────────────────────────────────────────────────

describe("App.tsx — routing (issue #17)", () => {
  const appPath = resolve(__dirname, "../App.tsx");
  const content = readFileSync(appPath, "utf-8");

  it("should import Routes and Route from react-router-dom", () => {
    expect(content).toMatch(/import.*Routes.*from "react-router-dom"/);
  });

  it("should define a route for / with MainMenu", () => {
    expect(content).toMatch(/path="\/".*element=\{?<MainMenu/);
  });

  it("should define a route for /choose", () => {
    expect(content).toMatch(/path="\/choose"/);
  });

  it("should define a route for /add", () => {
    expect(content).toMatch(/path="\/add"/);
  });

  it("should define a route for /edit", () => {
    expect(content).toMatch(/path="\/edit"/);
  });

  it("should define a route for /settings", () => {
    expect(content).toMatch(/path="\/settings"/);
  });
});

// ── DatabaseContext.tsx static checks ─────────────────────────────────────────

describe("DatabaseContext.tsx — database lifecycle", () => {
  const dbPath = resolve(__dirname, "../db/DatabaseContext.tsx");
  const content = readFileSync(dbPath, "utf-8");

  it("should use useEffect for database initialization", () => {
    expect(content).toMatch(/useEffect/);
  });

  it("should call dishDB.addCollections inside the effect", () => {
    expect(content).toMatch(/\.addCollections\(/);
  });

  it("should include try/catch for error handling", () => {
    expect(content).toMatch(/try\s*\{/);
    expect(content).toMatch(/catch\s*\(/);
  });

  it("should have a cleanup function that destroys the database", () => {
    expect(content).toMatch(/\.destroy\(\)/);
  });

  it("should handle StrictMode double-invocation via disposed flag", () => {
    expect(content).not.toMatch(/initRef/);
    expect(content).toMatch(/disposed/);
  });

  it("should expose a useDatabase hook", () => {
    expect(content).toMatch(/export function useDatabase/);
  });

  it("should export DatabaseProvider", () => {
    expect(content).toMatch(/export function DatabaseProvider/);
  });
});

// ── Component rendering (light mock) ─────────────────────────────────────────

describe("App component — rendering states", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders routes immediately while database initializes", async () => {
    vi.doMock("../db/DatabaseContext", () => ({
      DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
      useDatabase: () => ({ db: null, isLoading: true, error: null }),
    }));

    const { default: MockApp } = await import("../App");
    render(
      <MemoryRouter>
        <MockApp />
      </MemoryRouter>
    );
    expect(screen.getByAltText("Plat de la Semaine")).toBeTruthy();
  });

  it("shows error state when database fails", async () => {
    vi.doMock("../db/DatabaseContext", () => ({
      DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
      useDatabase: () => ({ db: null, isLoading: false, error: "IndexedDB unavailable" }),
    }));

    const { default: MockApp } = await import("../App");
    render(
      <MemoryRouter>
        <MockApp />
      </MemoryRouter>
    );
    expect(
      screen.getByText(/Failed to initialize database: IndexedDB unavailable/)
    ).toBeTruthy();
  });

  it("renders MainMenu when database is ready", async () => {
    vi.doMock("../db/DatabaseContext", () => ({
      DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
      useDatabase: () => ({
        db: { name: "dishes" } as unknown as import("../db/DatabaseContext").AppDatabase,
        isLoading: false,
        error: null,
      }),
    }));

    const { default: MockApp } = await import("../App");
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MockApp />
      </MemoryRouter>
    );
    expect(screen.getByText("Choisir le menu")).toBeTruthy();
  });
});

// ── Page placeholder components ───────────────────────────────────────────────

describe("Page placeholder files (issue #17)", () => {
  it("ChooseMenuPage exists and exports a default component", () => {
    const content = readFileSync(resolve(__dirname, "../pages/ChooseMenuPage.tsx"), "utf-8");
    expect(content).toMatch(/export default/);
    expect(content).toMatch(/Choisir le menu/);
  });

  it("CreateMenuPage exists and exports a default component", () => {
    const content = readFileSync(resolve(__dirname, "../pages/CreateMenuPage.tsx"), "utf-8");
    expect(content).toMatch(/export default/);
    expect(content).toMatch(/Créer un plat/);
  });

  it("EditDishPage exists and exports a default component", () => {
    const content = readFileSync(resolve(__dirname, "../pages/EditDishPage.tsx"), "utf-8");
    expect(content).toMatch(/export default/);
    expect(content).toMatch(/Modifier un plat/);
  });

  it("SettingsPage exists and exports a default component", () => {
    const content = readFileSync(resolve(__dirname, "../pages/SettingsPage.tsx"), "utf-8");
    expect(content).toMatch(/export default/);
    expect(content).toMatch(/Paramètres/);
  });
});
