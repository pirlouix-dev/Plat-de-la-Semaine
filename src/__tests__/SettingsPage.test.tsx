import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SettingsPage from "../pages/SettingsPage";
import { SETTINGS_SECTIONS } from "../pages/settingsConstants";

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Navigation tests ─────────────────────────────────────────────────────────

describe("Settings page — navigation", () => {
  it("renders without crashing", () => {
    const { container } = renderSettings();
    expect(container).toBeTruthy();
  });

  it("displays the page title", () => {
    renderSettings();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Paramètres",
    );
  });

  it("renders all 5 navigation items", () => {
    renderSettings();
    for (const section of SETTINGS_SECTIONS) {
      expect(
        screen.getByRole("button", { name: section.label }),
      ).toBeTruthy();
    }
  });

  it("defaults to the Info section", () => {
    renderSettings();
    // The heading and nav button both say "Informations pratiques", use getAllByText
    const matches = screen.getAllByText("Informations pratiques");
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Plat de la Semaine")).toBeInTheDocument();
  });

  it("navigates to a section on click", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Signaler un bug" }));

    expect(
      screen.getByRole("heading", { name: "Signaler un bug" }),
    ).toBeTruthy();
    expect(screen.getByPlaceholderText("Décrivez le bug…")).toBeTruthy();
  });

  it("marks the active nav item with aria-current", async () => {
    const user = userEvent.setup();
    renderSettings();

    // The nav button for Info should have aria-current
    const nav = screen.getByRole("navigation", { name: "Settings menu" });
    const infoBtn = within(nav).getByText("Informations pratiques");
    expect(infoBtn).toHaveAttribute("aria-current", "page");

    await user.click(
      within(nav).getByText("Retrier les plats"),
    );

    expect(infoBtn).not.toHaveAttribute("aria-current");
    expect(
      within(nav).getByText("Retrier les plats"),
    ).toHaveAttribute("aria-current", "page");
  });

  it("navigates with arrow keys", async () => {
    const user = userEvent.setup();
    renderSettings();

    const infoBtn = screen.getByRole("button", {
      name: "Informations pratiques",
    });
    infoBtn.focus();

    await user.keyboard("{ArrowDown}");

    expect(
      screen.getByRole("button", { name: "Restauration des données" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("wraps around with arrow keys", async () => {
    const user = userEvent.setup();
    renderSettings();

    const infoBtn = screen.getByRole("button", {
      name: "Informations pratiques",
    });
    infoBtn.focus();

    await user.keyboard("{ArrowUp}");

    // Should wrap to last item
    expect(
      screen.getByRole("button", { name: "Mises à jour" }),
    ).toHaveAttribute("aria-current", "page");
  });
});

// ── Info section ─────────────────────────────────────────────────────────────

describe("Settings page — Info section", () => {
  it("displays app name and version", () => {
    renderSettings();
    expect(screen.getByText("Plat de la Semaine")).toBeTruthy();
    expect(screen.getByText("v0.1.0")).toBeTruthy();
  });

  it("displays tech stack", () => {
    renderSettings();
    expect(screen.getByText("React + TypeScript + Vite")).toBeTruthy();
    expect(screen.getByText(".NET 8 + C#")).toBeTruthy();
    expect(screen.getByText("Firebase / Firestore")).toBeTruthy();
  });
});

// ── Backups section ──────────────────────────────────────────────────────────

describe("Settings page — Backups section", () => {
  it("shows loading state initially", async () => {
    // Never resolve the fetch so we can catch the loading state
    mockFetch.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Restauration des données" }));

    expect(screen.getByText("Loading backups…")).toBeTruthy();
  });

  it("displays empty message when no backups", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Restauration des données" }));
    // Wait for loading to finish
    await vi.waitFor(() => {
      expect(screen.queryByText("Loading backups…")).toBeNull();
    });

    expect(screen.getByText("No backups available.")).toBeTruthy();
  });

  it("displays a list of backups", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: "b1",
              label: "Weekly backup",
              createdAt: "2026-07-20T10:00:00Z",
              dishCount: 12,
            },
            {
              id: "b2",
              label: "Monthly backup",
              createdAt: "2026-06-01T10:00:00Z",
              dishCount: 8,
            },
          ],
        }),
    });

    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Restauration des données" }));
    await vi.waitFor(() => {
      expect(screen.queryByText("Loading backups…")).toBeNull();
    });

    expect(screen.getByText("Weekly backup")).toBeTruthy();
    expect(screen.getByText("Monthly backup")).toBeTruthy();
    expect(screen.getByText(/12 dish/)).toBeTruthy();
    expect(screen.getByText(/8 dish/)).toBeTruthy();
  });

  it("calls restore endpoint on restore click", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ id: "b1", label: "Backup", createdAt: "2026-07-20T10:00:00Z", dishCount: 5 }],
          }),
      })
      .mockResolvedValueOnce({ ok: true }) // restore call
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }), // refresh
      });

    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Restauration des données" }));
    await vi.waitFor(() => {
      expect(screen.queryByText("Loading backups…")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Revenir" }));

    expect(mockFetch).toHaveBeenCalledWith("/api/backups/restore/b1", {
      method: "POST",
    });
  });
});

// ── Bug report section ───────────────────────────────────────────────────────

describe("Settings page — Bug report section", () => {
  it("renders the text area and send button", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Signaler un bug" }));

    expect(screen.getByPlaceholderText("Décrivez le bug…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeTruthy();
  });

  it("disables send button when text area is empty", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Signaler un bug" }));

    expect(screen.getByRole("button", { name: "Envoyer" })).toBeDisabled();
  });

  it("enables send button after typing", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Signaler un bug" }));
    await user.type(screen.getByPlaceholderText("Décrivez le bug…"), "Test bug");

    expect(screen.getByRole("button", { name: "Envoyer" })).not.toBeDisabled();
  });

  it("shows success message on successful submit", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Signaler un bug" }));
    await user.type(screen.getByPlaceholderText("Décrivez le bug…"), "Bug report");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await vi.waitFor(() => {
      expect(screen.getByText(/Merci/)).toBeTruthy();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Bug report" }),
    });
  });

  it("shows error message on failed submit", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Signaler un bug" }));
    await user.type(screen.getByPlaceholderText("Décrivez le bug…"), "Bug report");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await vi.waitFor(() => {
      expect(screen.getByText(/Échec de l'envoi/)).toBeTruthy();
    });
  });
});

// ── Re-sort section ──────────────────────────────────────────────────────────

describe("Settings page — Re-sort section", () => {
  it("renders the re-sort button", async () => {
    const user = userEvent.setup();
    renderSettings();

    const nav = screen.getByRole("navigation", { name: "Settings menu" });
    await user.click(within(nav).getByText("Retrier les plats"));

    // Should have a nav button and an action button with the same label
    const buttons = screen.getAllByRole("button", { name: "Retrier les plats" });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("shows success message after sorting", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Retrier les plats" }));
    // There are two elements with this text — the nav item and the action button
    const buttons = screen.getAllByRole("button", { name: "Retrier les plats" });
    // The action button is the second one (nav is first)
    const actionButton = buttons[1];
    await user.click(actionButton);

    await vi.waitFor(() => {
      expect(screen.getByText(/triés avec succès/)).toBeTruthy();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/dishes/resort", {
      method: "POST",
    });
  });
});

// ── Updates section ──────────────────────────────────────────────────────────

describe("Settings page — Updates section", () => {
  it("shows up-to-date message when versions match", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { latestVersion: "0.1.0" } }),
    });

    const user = userEvent.setup();
    renderSettings();

    const nav = screen.getByRole("navigation", { name: "Settings menu" });
    await user.click(within(nav).getByText("Mises à jour"));

    await vi.waitFor(() => {
      expect(screen.getByText(/Vous êtes à jour/)).toBeTruthy();
    });
  });

  it("shows update available when versions differ", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { latestVersion: "1.0.0" } }),
    });

    const user = userEvent.setup();
    renderSettings();

    const nav = screen.getByRole("navigation", { name: "Settings menu" });
    await user.click(within(nav).getByText("Mises à jour"));

    await vi.waitFor(() => {
      expect(screen.getByText(/nouvelle version/)).toBeTruthy();
    });
    expect(screen.getByText("Mettre à jour")).toBeTruthy();
  });

  it("shows error on failed version check", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const user = userEvent.setup();
    renderSettings();

    const nav = screen.getByRole("navigation", { name: "Settings menu" });
    await user.click(within(nav).getByText("Mises à jour"));

    await vi.waitFor(() => {
      expect(screen.getByText(/HTTP 500/)).toBeTruthy();
    });
  });
});
