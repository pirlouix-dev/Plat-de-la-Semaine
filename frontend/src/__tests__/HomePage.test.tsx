import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "../pages/HomePage/HomePage";
import { useSyncStatus } from "../hooks/useSyncStatus";
import type { SyncDisplay } from "../hooks/useSyncStatus";
import { createTranslator } from "../i18n";

const t = createTranslator("en");

vi.mock("../hooks/useSyncStatus", () => ({
  useSyncStatus: vi.fn(),
}));

const mockUseSyncStatus = vi.mocked(useSyncStatus);

function mockSyncStatus(overrides: Partial<SyncDisplay> = {}): void {
  mockUseSyncStatus.mockReturnValue({
    text: t("sync.synced", { age: t("sync.age.minutes", { count: 5 }) }),
    isError: false,
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
  mockSyncStatus();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    }),
  );
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
    expect(screen.getByText(t("home.menu.choose"))).toBeTruthy();
    expect(screen.getByText(t("home.menu.add"))).toBeTruthy();
    expect(screen.getByText(t("home.menu.edit"))).toBeTruthy();
    expect(screen.getByText(t("home.menu.settings"))).toBeTruthy();
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
    expect(screen.getByAltText(t("home.menu.choose"))).toBeTruthy();
    expect(screen.getByAltText(t("home.menu.add"))).toBeTruthy();
    expect(screen.getByAltText(t("home.menu.edit"))).toBeTruthy();
    expect(screen.getByAltText(t("home.menu.settings"))).toBeTruthy();
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
    expect(
      screen.getByText(t("home.greeting", { username: "Mathéo" })),
    ).toBeTruthy();
    expect(
      screen.getByText(
        t("sync.synced", { age: t("sync.age.minutes", { count: 5 }) }),
      ),
    ).toBeTruthy();
    expect(screen.getByText(t("home.account"))).toBeTruthy();
  });

  it("shows the syncing message while a sync is running", () => {
    localStorage.setItem("user_id", "user-42");
    mockSyncStatus({ text: t("sync.syncing"), isError: false });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText(t("sync.syncing"))).toBeTruthy();
  });

  it("shows the offline message in red when offline", () => {
    localStorage.setItem("user_id", "user-42");
    mockSyncStatus({
      text: t("sync.offline"),
      isError: true,
    });

    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText(t("sync.offline"))).toBeTruthy();
    expect(container.querySelector(".account-subtitle--error")).toBeTruthy();
  });

  it("shows the sync error message in red when the last sync failed", () => {
    localStorage.setItem("user_id", "user-42");
    mockSyncStatus({
      text: t("sync.failedRetry", { count: 3 }),
      isError: true,
    });

    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText(t("sync.failedRetry", { count: 3 }))).toBeTruthy();
    expect(container.querySelector(".account-subtitle--error")).toBeTruthy();
  });

  it("keeps the guest subtitle regardless of sync state", () => {
    mockSyncStatus({ text: t("sync.syncing"), isError: false });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText(t("home.guestHint"))).toBeTruthy();
  });

  it("pings the backend on mount when visiting as a guest", async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await vi.waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("/api/ping")),
      ).toBe(true);
    });
  });

  it("does not ping the backend when logged in (sync warms the server)", async () => {
    localStorage.setItem("user_id", "user-42");
    localStorage.setItem("user_username", "Mathéo");

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
