import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../App";

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

  it("should still render MainMenu when database is ready", () => {
    expect(content).toMatch(/<MainMenu\s*\/>/);
  });

  it("should export App as default", () => {
    expect(content).toMatch(/export default App/);
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

  it("should guard against StrictMode double-invocation", () => {
    expect(content).toMatch(/initRef/);
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

  it("shows loading state while database initializes", async () => {
    // Mock the db module to never resolve (stay in loading)
    vi.doMock("../db/DatabaseContext", () => ({
      DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
      useDatabase: () => ({ db: null, isLoading: true, error: null }),
    }));

    const { default: MockApp } = await import("../App");
    render(<MockApp />);
    expect(screen.getByText("Loading database...")).toBeTruthy();
  });

  it("shows error state when database fails", async () => {
    vi.doMock("../db/DatabaseContext", () => ({
      DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
      useDatabase: () => ({ db: null, isLoading: false, error: "IndexedDB unavailable" }),
    }));

    const { default: MockApp } = await import("../App");
    render(<MockApp />);
    expect(
      screen.getByText(/Failed to initialize database: IndexedDB unavailable/)
    ).toBeTruthy();
  });

  it("renders MainMenu when database is ready", async () => {
    vi.doMock("../db/DatabaseContext", () => ({
      DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
      useDatabase: () => ({
        db: { name: "dishes" } as any,
        isLoading: false,
        error: null,
      }),
    }));

    const { default: MockApp } = await import("../App");
    render(<MockApp />);
    expect(screen.getByText("Choisir le menu")).toBeTruthy();
  });
});
