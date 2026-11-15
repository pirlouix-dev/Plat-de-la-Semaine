import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
  createMemoryRouter,
  RouterProvider,
} from "react-router-dom";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function HashProbe() {
  const location = useLocation();
  return <div data-testid="hash">{location.hash}</div>;
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

const mockGetBackups = vi.fn();
const mockRestoreBackup = vi.fn();
const mockGetVersionInfo = vi.fn();
const mockSubmitFeedback = vi.fn();
const mockGetLastSyncAt = vi.fn();
const mockRefreshFromServer = vi.fn();
const mockImportDishes = vi.fn();
const mockInsertManyDishes = vi.fn();
const mockBuildPendingDishes = vi.fn();
const mockGetAllDishes = vi.fn();
const mockShowToast = vi.fn();
const mockClearAuth = vi.fn();
const mockUpdateUsername = vi.fn();
const mockResetPassword = vi.fn();
const mockDeleteAccount = vi.fn();
const mockIsLoggedIn = vi.fn();
const mockUseSyncState = vi.fn();
const mockRemoveLocalDatabaseForUser = vi.fn();

vi.mock("../db/DatabaseContext", () => ({
  useDatabase: () => ({
    db: {},
    isLoading: false,
    error: null,
    dbUserId: null,
  }),
}));

vi.mock("../db/databaseManagerInstance", () => ({
  removeLocalDatabaseForUser: (...args: unknown[]) =>
    mockRemoveLocalDatabaseForUser(...args),
}));

vi.mock("../components/toastContext", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock("../services/backupService", () => ({
  getBackups: (...args: unknown[]) => mockGetBackups(...args),
  restoreBackup: (...args: unknown[]) => mockRestoreBackup(...args),
}));

vi.mock("../services/settingsService", () => ({
  getVersionInfo: (...args: unknown[]) => mockGetVersionInfo(...args),
  submitFeedback: (...args: unknown[]) => mockSubmitFeedback(...args),
}));

vi.mock("../services/syncService", () => ({
  getLastSyncAt: (...args: unknown[]) => mockGetLastSyncAt(...args),
  refreshFromServer: (...args: unknown[]) => mockRefreshFromServer(...args),
}));

vi.mock("../services/dishService", () => ({
  importDishes: (...args: unknown[]) => mockImportDishes(...args),
}));

vi.mock("../repositories/dishRepository", () => ({
  insertManyDishes: (...args: unknown[]) => mockInsertManyDishes(...args),
  buildPendingDishes: (...args: unknown[]) => mockBuildPendingDishes(...args),
  getAllDishes: (...args: unknown[]) => mockGetAllDishes(...args),
}));

vi.mock("../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/api")>();
  return {
    ...actual,
    clearAuth: (...args: unknown[]) => mockClearAuth(...args),
  };
});

vi.mock("../services/authService", () => ({
  updateUsername: (...args: unknown[]) => mockUpdateUsername(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

vi.mock("../hooks/useIsLoggedIn", () => ({
  useIsLoggedIn: () => mockIsLoggedIn(),
}));

vi.mock("../hooks/useSyncStatus", () => ({
  useSyncState: () => mockUseSyncState(),
}));

import SettingsPage from "../pages/SettingsPage/SettingsPage";

function renderSettingsPage(entry = "/settings") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/settings"
          element={
            <>
              <SettingsPage />
              <HashProbe />
            </>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderSettingsWithHistory(entry = "/settings") {
  const router = createMemoryRouter(
    [
      {
        path: "/settings",
        element: (
          <>
            <SettingsPage />
            <HashProbe />
          </>
        ),
      },
      { path: "/", element: <LocationProbe /> },
    ],
    { initialEntries: [entry] },
  );
  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
}

describe("SettingsPage", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    localStorage.setItem("user_username", "toto");
    mockGetBackups.mockResolvedValue({ ok: true, data: [] });
    mockRestoreBackup.mockResolvedValue({ ok: true, data: { backupId: "x", restoredCount: 0, safetyBackupCreatedAt: "" } });
    mockGetVersionInfo.mockResolvedValue({ ok: true, data: null });
    mockSubmitFeedback.mockResolvedValue({ ok: true, data: undefined });
    mockGetLastSyncAt.mockResolvedValue(null);
    mockRefreshFromServer.mockResolvedValue(true);
    mockImportDishes.mockResolvedValue({
      ok: true,
      data: { imported: 1, failed: 0, errors: [] },
    });
    mockInsertManyDishes.mockResolvedValue(undefined);
    mockBuildPendingDishes.mockReturnValue([
      { id: "local-1", syncStatus: "pending_create" },
    ]);
    mockGetAllDishes.mockResolvedValue([]);
    mockClearAuth.mockImplementation(() => {});
    mockUpdateUsername.mockResolvedValue({ ok: true, data: undefined });
    mockResetPassword.mockResolvedValue({ ok: true, data: undefined });
    mockDeleteAccount.mockResolvedValue({ ok: true, data: { message: "Account deleted" } });
    mockRemoveLocalDatabaseForUser.mockResolvedValue(undefined);
    mockIsLoggedIn.mockReturnValue(true);
    mockUseSyncState.mockReturnValue({
      phase: "idle",
      online: true,
      lastSyncAt: null,
      lastErrorAt: null,
      retryCount: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("navigates to home when back is pressed on desktop", () => {
    renderSettingsPage();
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("returns to summary first on mobile then navigates home", () => {
    mockMatchMedia(true);
    renderSettingsPage();
    fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(screen.getByRole("heading", { name: "Paramètres" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  describe("URL-driven navigation", () => {
    it("pushes the active tab into the URL hash on mobile", () => {
      mockMatchMedia(true);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));

      expect(screen.getByTestId("hash")).toHaveTextContent("#data");
    });

    it("returns to the summary on browser back from a mobile subpage", async () => {
      mockMatchMedia(true);
      const { router } = renderSettingsWithHistory();
      fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));
      expect(
        screen.getByRole("heading", { name: "Données & Plats" }),
      ).toBeTruthy();

      await act(async () => {
        await router.navigate(-1);
      });

      expect(
        screen.getByRole("heading", { name: "Paramètres" }),
      ).toBeTruthy();
      expect(screen.getByTestId("hash")).toHaveTextContent("");
    });

    it("replaces to the summary when leaving a deep-linked subpage", () => {
      mockMatchMedia(true);
      renderSettingsPage("/settings#data");

      fireEvent.click(screen.getByRole("button", { name: "Retour" }));

      expect(
        screen.getByRole("heading", { name: "Paramètres" }),
      ).toBeTruthy();
      expect(screen.getByTestId("hash")).toHaveTextContent("");
      expect(screen.queryByTestId("location")).toBeNull();
    });

    it("leaves settings on desktop back even after switching tabs", () => {
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));
      expect(screen.getByTestId("hash")).toHaveTextContent("#data");

      fireEvent.click(screen.getByRole("button", { name: "Retour" }));

      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });
  });

  it("calls clearAuth and navigates to / on logout", () => {
    renderSettingsPage();
    fireEvent.click(screen.getByRole("button", { name: /se déconnecter/i }));
    expect(mockClearAuth).toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  describe("Data & Plats tab", () => {
    describe("manual full refresh", () => {
      function renderDataTab() {
        mockMatchMedia(false);
        const rendered = renderSettingsPage();
        fireEvent.click(
          screen.getByRole("button", { name: /données & plats/i }),
        );
        return rendered;
      }

      function refreshButton() {
        return screen.getByRole("button", {
          name: /rafraîchir les plats depuis le serveur/i,
        });
      }

      it("forces a full pull when clicked", async () => {
        renderDataTab();

        fireEvent.click(refreshButton());

        await waitFor(() => {
          expect(mockRefreshFromServer).toHaveBeenCalledWith({});
          expect(mockShowToast).toHaveBeenCalledWith(
            "Plats rafraîchis depuis le serveur",
            "success",
          );
        });
      });

      it("disables the button and shows progress while refreshing", async () => {
        let resolveRefresh!: (value: boolean) => void;
        mockRefreshFromServer.mockReturnValue(
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
        );
        renderDataTab();

        fireEvent.click(refreshButton());

        expect(
          screen.getByRole("button", { name: /rafraîchissement…/i }),
        ).toBeDisabled();

        await act(async () => {
          resolveRefresh(true);
        });

        await waitFor(() => {
          expect(refreshButton()).toBeEnabled();
        });
      });

      it("is disabled while a scheduled sync is running", () => {
        mockUseSyncState.mockReturnValue({
          phase: "syncing",
          online: true,
          lastSyncAt: null,
          lastErrorAt: null,
          retryCount: 0,
        });
        renderDataTab();

        expect(refreshButton()).toBeDisabled();
      });

      it("shows the updated last sync date on success", async () => {
        mockGetLastSyncAt.mockResolvedValue(null);
        renderDataTab();

        await waitFor(() => {
          expect(
            screen.getByText(/Dernière synchronisation : Jamais/),
          ).toBeTruthy();
        });

        mockGetLastSyncAt.mockResolvedValue("2026-08-25T09:21:00Z");
        fireEvent.click(refreshButton());

        await waitFor(() => {
          expect(
            screen.queryByText(/Dernière synchronisation : Jamais/),
          ).toBeNull();
        });
        expect(
          screen.getByText(/Dernière synchronisation : .+ à \d{2}:\d{2}/),
        ).toBeTruthy();
      });

      it("shows an error toast when the refresh fails", async () => {
        mockRefreshFromServer.mockResolvedValue(false);
        renderDataTab();

        fireEvent.click(refreshButton());

        await waitFor(() => {
          expect(mockShowToast).toHaveBeenCalledWith(
            "Le rafraîchissement des plats a échoué. Réessayez plus tard.",
            "error",
          );
        });
        expect(mockShowToast).not.toHaveBeenCalledWith(
          "Plats rafraîchis depuis le serveur",
          "success",
        );
      });

      it("shows an offline error toast when offline", async () => {
        vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
        mockRefreshFromServer.mockResolvedValue(false);
        renderDataTab();

        fireEvent.click(refreshButton());

        await waitFor(() => {
          expect(mockShowToast).toHaveBeenCalledWith(
            "Vous êtes hors ligne. Réessayez une fois reconnecté.",
            "error",
          );
        });
      });
    });

    it("fetches backups when switching to the data tab", async () => {
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));
      await waitFor(() => {
        expect(mockGetBackups).toHaveBeenCalledTimes(1);
      });
    });

    it("displays backups in a timeline", async () => {
      mockGetBackups.mockResolvedValue({
        ok: true,
        data: [
          { id: "b1", createdAt: "2026-08-25T09:21:00Z", dishCount: 16 },
          { id: "b2", createdAt: "2026-08-19T17:45:00Z", dishCount: 14 },
        ],
      });
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));

      await waitFor(() => {
        expect(screen.getByText(/16/)).toBeTruthy();
        expect(screen.getByText(/14/)).toBeTruthy();
      });
    });

    it("marks the first backup as current", async () => {
      mockGetBackups.mockResolvedValue({
        ok: true,
        data: [
          { id: "b1", createdAt: "2026-08-25T09:21:00Z", dishCount: 16 },
          { id: "b2", createdAt: "2026-08-19T17:45:00Z", dishCount: 14 },
        ],
      });
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));

      await waitFor(() => {
        expect(screen.getByText("● Version active")).toBeTruthy();
        expect(screen.getAllByText("Restaurer")).toHaveLength(1);
      });
    });

    it("calls restoreBackup and re-fetches on success", async () => {
      mockGetBackups.mockResolvedValue({
        ok: true,
        data: [
          { id: "b1", createdAt: "2026-08-25T09:21:00Z", dishCount: 16 },
          { id: "b2", createdAt: "2026-08-19T17:45:00Z", dishCount: 14 },
        ],
      });
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));

      await waitFor(() => {
        expect(screen.getByText("Restaurer")).toBeTruthy();
      });

      fireEvent.click(screen.getByText("Restaurer"));

      await waitFor(() => {
        expect(mockRestoreBackup).toHaveBeenCalledWith("b2");
        expect(mockShowToast).toHaveBeenCalledWith(
          "Sauvegarde restaurée avec succès",
          "success",
        );
        expect(mockGetBackups).toHaveBeenCalledTimes(2);
      });
    });

    it("shows error toast when restore fails", async () => {
      mockRestoreBackup.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Backup not found" },
      });
      mockGetBackups.mockResolvedValue({
        ok: true,
        data: [
          { id: "b1", createdAt: "2026-08-25T09:21:00Z", dishCount: 16 },
          { id: "b2", createdAt: "2026-08-19T17:45:00Z", dishCount: 14 },
        ],
      });
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));

      await waitFor(() => {
        expect(screen.getByText("Restaurer")).toBeTruthy();
      });

      fireEvent.click(screen.getByText("Restaurer"));

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          "L'élément demandé est introuvable.",
          "error",
        );
      });
    });

    it("shows error message when backups fetch fails", async () => {
      mockGetBackups.mockResolvedValue({
        ok: false,
        error: { code: "SERVER_ERROR", message: "Internal server error" },
      });
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));

      await waitFor(() => {
        expect(screen.getByText("Une erreur est survenue.")).toBeTruthy();
        expect(screen.queryByText("Internal server error")).toBeNull();
      });
    });

    it("shows empty state when no backups exist", async () => {
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));

      await waitFor(() => {
        expect(screen.getByText("Aucune sauvegarde disponible.")).toBeTruthy();
      });
    });

    describe("JSON import", () => {
      function renderDataTab() {
        mockMatchMedia(false);
        const rendered = renderSettingsPage();
        fireEvent.click(
          screen.getByRole("button", { name: /données & plats/i }),
        );
        return rendered;
      }

      async function selectFile(container: HTMLElement, content: string) {
        const input = container.querySelector(
          'input[type="file"]',
        ) as HTMLInputElement;
        const file = new File([content], "dishes.json", {
          type: "application/json",
        });
        await act(async () => {
          fireEvent.change(input, { target: { files: [file] } });
        });
      }

      it("opens the file picker when the import button is clicked", () => {
        const { container } = renderDataTab();
        const input = container.querySelector(
          'input[type="file"]',
        ) as HTMLInputElement;
        const clickSpy = vi.spyOn(input, "click");

        fireEvent.click(
          screen.getByRole("button", { name: /importer depuis un fichier json/i }),
        );

        expect(clickSpy).toHaveBeenCalled();
      });

      it("imports a selected file through the API and refreshes local data", async () => {
        const { container } = renderDataTab();
        await selectFile(
          container,
          JSON.stringify([{ name: "Ratatouille", course: 1, seasons: [1] }]),
        );

        await waitFor(() => {
          expect(mockImportDishes).toHaveBeenCalledWith([
            {
              name: "Ratatouille",
              description: "",
              course: 1,
              seasons: [1],
            },
          ]);
          expect(mockRefreshFromServer).toHaveBeenCalled();
          expect(mockShowToast).toHaveBeenCalledWith(
            "1 plat(s) importé(s)",
            "success",
          );
        });
      });

      it("disables the import button while the import is running", async () => {
        let resolveImport!: (value: unknown) => void;
        mockImportDishes.mockReturnValue(
          new Promise((resolve) => {
            resolveImport = resolve;
          }),
        );
        const { container } = renderDataTab();
        await selectFile(
          container,
          JSON.stringify([{ name: "Quiche", course: 1, seasons: [0] }]),
        );

        expect(
          screen.getByRole("button", { name: /importer depuis un fichier json…/i }),
        ).toBeDisabled();

        await act(async () => {
          resolveImport({
            ok: true,
            data: { imported: 1, failed: 0, errors: [] },
          });
        });

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /importer depuis un fichier json$/i }),
          ).toBeEnabled();
        });
      });

      it("rejects malformed JSON with an error toast", async () => {
        const { container } = renderDataTab();
        await selectFile(container, "{ not json");

        await waitFor(() => {
          expect(mockShowToast).toHaveBeenCalledWith(
            "Le fichier n'est pas un JSON valide.",
            "error",
          );
        });
        expect(mockImportDishes).not.toHaveBeenCalled();
      });

      it("stores dishes locally when offline", async () => {
        vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
        const { container } = renderDataTab();
        await selectFile(
          container,
          JSON.stringify([{ name: "Quiche", course: 1, seasons: [0] }]),
        );

        await waitFor(() => {
          expect(mockImportDishes).not.toHaveBeenCalled();
          expect(mockBuildPendingDishes).toHaveBeenCalled();
          expect(mockInsertManyDishes).toHaveBeenCalled();
          expect(mockShowToast).toHaveBeenCalledWith(
            "1 plat(s) enregistré(s) localement",
            "success",
          );
        });
      });

      it("skips invalid items and reports them", async () => {
        const { container } = renderDataTab();
        await selectFile(
          container,
          JSON.stringify([
            { name: "Ok", course: 1, seasons: [0] },
            { name: "", course: 1, seasons: [0] },
          ]),
        );

        await waitFor(() => {
          expect(mockImportDishes).toHaveBeenCalledWith([
            { name: "Ok", description: "", course: 1, seasons: [0] },
          ]);
          expect(mockShowToast).toHaveBeenCalledWith(
            "1 plat(s) importé(s), 1 en échec",
            "error",
          );
        });
      });

      it("shows the API error message when the import fails", async () => {
        mockImportDishes.mockResolvedValue({
          ok: false,
          error: { code: "SERVER_ERROR", message: "Import impossible" },
        });
        const { container } = renderDataTab();
        await selectFile(
          container,
          JSON.stringify([{ name: "Quiche", course: 1, seasons: [0] }]),
        );

        await waitFor(() => {
          expect(mockShowToast).toHaveBeenCalledWith(
            "Une erreur est survenue.",
            "error",
          );
        });
      });
    });

    describe("JSON export", () => {
      function makeDish(overrides: Record<string, unknown> = {}) {
        return {
          id: crypto.randomUUID(),
          serverId: "server-1",
          name: "Ratatouille",
          description: "Légumes mijotés",
          course: 1,
          seasons: [1, 2],
          updatedAt: "2026-01-01T00:00:00.000Z",
          isDeleted: false,
          syncStatus: "synced",
          ...overrides,
        };
      }

      function renderDataTab() {
        mockMatchMedia(false);
        const rendered = renderSettingsPage();
        fireEvent.click(
          screen.getByRole("button", { name: /données & plats/i }),
        );
        return rendered;
      }

      function stubDownload() {
        let captured: Blob | undefined;
        const createObjectURL = vi
          .spyOn(URL, "createObjectURL")
          .mockImplementation((value: Blob | MediaSource) => {
            captured = value as Blob;
            return "blob:mock";
          });
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
        const clickSpy = vi
          .spyOn(HTMLAnchorElement.prototype, "click")
          .mockImplementation(() => {});
        return {
          getBlob: () => captured,
          createObjectURL,
          clickSpy,
        };
      }

      it("downloads the dishes as JSON and reports the count", async () => {
        mockGetAllDishes.mockResolvedValue([
          makeDish({ name: "Ratatouille" }),
          makeDish({
            name: "Tarte",
            course: 2,
            seasons: [2],
            description: "",
          }),
        ]);
        const { getBlob, clickSpy } = stubDownload();
        renderDataTab();

        fireEvent.click(
          screen.getByRole("button", { name: /exporter dans un fichier json/i }),
        );

        await waitFor(() => {
          expect(mockShowToast).toHaveBeenCalledWith(
            "2 plat(s) exporté(s)",
            "success",
          );
        });
        expect(clickSpy).toHaveBeenCalledTimes(1);

        const blob = getBlob();
        expect(blob?.type).toBe("application/json");
        const parsed = JSON.parse(await blob!.text());
        expect(parsed).toEqual([
          { name: "Ratatouille", description: "Légumes mijotés", course: 1, seasons: [1, 2] },
          { name: "Tarte", description: "", course: 2, seasons: [2] },
        ]);
      });

      it("excludes soft-deleted dishes from the download", async () => {
        mockGetAllDishes.mockResolvedValue([
          makeDish({ name: "Kept" }),
          makeDish({ name: "Deleted", isDeleted: true }),
        ]);
        const { getBlob } = stubDownload();
        renderDataTab();

        fireEvent.click(
          screen.getByRole("button", { name: /exporter dans un fichier json/i }),
        );

        await waitFor(() => {
          expect(mockShowToast).toHaveBeenCalledWith(
            "1 plat(s) exporté(s)",
            "success",
          );
        });
        expect(JSON.parse(await getBlob()!.text())).toHaveLength(1);
      });

      it("shows an error and downloads nothing when there are no dishes", async () => {
        mockGetAllDishes.mockResolvedValue([]);
        const { createObjectURL, clickSpy } = stubDownload();
        renderDataTab();

        fireEvent.click(
          screen.getByRole("button", { name: /exporter dans un fichier json/i }),
        );

        await waitFor(() => {
          expect(mockShowToast).toHaveBeenCalledWith(
            "Aucun plat à exporter.",
            "error",
          );
        });
        expect(createObjectURL).not.toHaveBeenCalled();
        expect(clickSpy).not.toHaveBeenCalled();
      });

      it("disables the export button while the export is running", async () => {
        let resolveDishes!: (value: unknown) => void;
        mockGetAllDishes.mockReturnValue(
          new Promise((resolve) => {
            resolveDishes = resolve;
          }),
        );
        stubDownload();
        renderDataTab();

        fireEvent.click(
          screen.getByRole("button", { name: /exporter dans un fichier json/i }),
        );

        expect(
          screen.getByRole("button", { name: /export en cours…/i }),
        ).toBeDisabled();

        await act(async () => {
          resolveDishes([makeDish()]);
        });

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /^exporter dans un fichier json$/i }),
          ).toBeEnabled();
        });
      });
    });
  });

  describe("Bug Report tab", () => {
    it("submits feedback with message and app version", async () => {
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /signaler un bug/i }));

      const textarea = screen.getByPlaceholderText(/lorsque j'accepte/i);
      fireEvent.change(textarea, {
        target: { value: "Bug: crash on accept" },
      });
      fireEvent.click(screen.getByRole("button", { name: /envoyer le rapport/i }));

      await waitFor(() => {
        expect(mockSubmitFeedback).toHaveBeenCalledWith({
          message: "Bug: crash on accept",
          appVersion: expect.any(String),
        });
        expect(mockShowToast).toHaveBeenCalledWith("Rapport envoyé, merci !", "success");
      });
    });

    it("shows error toast when feedback submission fails", async () => {
      mockSubmitFeedback.mockResolvedValue({
        ok: false,
        error: { code: "RATE_LIMITED", message: "Too many requests" },
      });
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /signaler un bug/i }));

      const textarea = screen.getByPlaceholderText(/lorsque j'accepte/i);
      fireEvent.change(textarea, { target: { value: "test" } });
      fireEvent.click(screen.getByRole("button", { name: /envoyer le rapport/i }));

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          "Trop de signalements envoyés. Veuillez réessayer plus tard.",
          "error",
        );
      });
    });
  });

  describe("About tab", () => {
    it("fetches version info on mount and sync on tab switch", async () => {
      mockGetVersionInfo.mockResolvedValue({
        ok: true,
        data: { latestVersion: "1.0.0" },
      });
      mockMatchMedia(false);
      renderSettingsPage();

      await waitFor(() => {
        expect(mockGetVersionInfo).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole("button", { name: /à propos/i }));

      await waitFor(() => {
        expect(mockGetLastSyncAt).toHaveBeenCalled();
      });
    });

    it("displays version from the API", async () => {
      mockGetVersionInfo.mockResolvedValue({
        ok: true,
        data: { latestVersion: "2.0.0" },
      });
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /à propos/i }));

      await waitFor(() => {
        expect(screen.getByText("2.0.0")).toBeTruthy();
      });
    });

    it("shows Jamais when no sync has occurred", async () => {
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /à propos/i }));

      await waitFor(() => {
        expect(screen.getByText("Jamais")).toBeTruthy();
      });
    });
  });

  describe("Account tab", () => {
    it("calls updateUsername and shows success toast", async () => {
      localStorage.setItem("auth_token", "test-token");
      mockMatchMedia(false);
      renderSettingsPage();

      const input = screen.getByLabelText(/nom d'utilisateur/i);
      fireEvent.change(input, { target: { value: "nouveau_nom" } });
      fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

      await waitFor(() => {
        expect(mockUpdateUsername).toHaveBeenCalledWith("nouveau_nom");
        expect(mockShowToast).toHaveBeenCalledWith(
          "Nom d'utilisateur mis à jour",
          "success",
        );
      });
    });

    it("shows error toast when username update fails", async () => {
      mockUpdateUsername.mockResolvedValue({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "The username is invalid.",
        },
      });
      localStorage.setItem("auth_token", "test-token");
      mockMatchMedia(false);
      renderSettingsPage();

      const input = screen.getByLabelText(/nom d'utilisateur/i);
      fireEvent.change(input, { target: { value: "pris" } });
      fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          "Certaines informations sont invalides. Vérifiez votre saisie.",
          "error",
        );
      });
    });

    it("disables save button when username is unchanged", () => {
      mockMatchMedia(false);
      renderSettingsPage();

      const saveBtn = screen.getByRole("button", { name: /enregistrer/i });
      expect(saveBtn).toBeDisabled();
    });

    it("sends password reset email and shows success toast", async () => {
      mockMatchMedia(false);
      renderSettingsPage();

      fireEvent.click(
        screen.getByRole("button", { name: /réinitialiser le mot de passe/i }),
      );

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith(
          "Email de réinitialisation envoyé. Il se situe probablement dans vos spams.",
          "warning",
        );
      });
    });

    it("shows error toast when password reset fails", async () => {
      mockResetPassword.mockResolvedValue({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
      });
      mockMatchMedia(false);
      renderSettingsPage();

      fireEvent.click(
        screen.getByRole("button", { name: /réinitialiser le mot de passe/i }),
      );

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          "Le serveur a rencontré une erreur. Veuillez réessayer plus tard.",
          "error",
        );
      });
    });

    it("shows delete confirmation modal", async () => {
      mockMatchMedia(false);
      renderSettingsPage();

      fireEvent.click(screen.getByRole("button", { name: /supprimer le compte/i }));
      expect(
        screen.getByText(/voulez-vous vraiment supprimer votre compte/i),
      ).toBeTruthy();
    });

    it("cancels account deletion when cancel is clicked", async () => {
      mockMatchMedia(false);
      renderSettingsPage();

      fireEvent.click(screen.getByRole("button", { name: /supprimer le compte/i }));
      fireEvent.click(screen.getByRole("button", { name: /annuler/i }));

      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("deletes account and navigates to home on success", async () => {
      mockMatchMedia(false);
      renderSettingsPage();

      fireEvent.click(screen.getByRole("button", { name: /supprimer le compte/i }));
      fireEvent.click(
        screen.getByRole("button", { name: /^supprimer$/i }),
      );

      await waitFor(() => {
        expect(mockDeleteAccount).toHaveBeenCalled();
        expect(mockClearAuth).toHaveBeenCalled();
        expect(screen.getByTestId("location")).toHaveTextContent("/");
      });
    });

    it("shows error toast when account deletion fails", async () => {
      mockDeleteAccount.mockResolvedValue({
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid authorization header.",
        },
      });
      mockMatchMedia(false);
      renderSettingsPage();

      fireEvent.click(screen.getByRole("button", { name: /supprimer le compte/i }));
      fireEvent.click(
        screen.getByRole("button", { name: /^supprimer$/i }),
      );

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          "Votre session a expiré. Veuillez vous reconnecter.",
          "error",
        );
      });
    });
  });

  describe("Guest mode (not logged in)", () => {
    beforeEach(() => {
      mockIsLoggedIn.mockReturnValue(false);
    });

    it("shows login prompt on the Account tab", () => {
      mockMatchMedia(false);
      renderSettingsPage();

      expect(screen.getByText(/connectez-vous pour accéder/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /se connecter/i })).toBeTruthy();
      expect(screen.queryByText(/nom d'utilisateur/i)).toBeNull();
    });

    it("navigates to /login when login button is clicked", () => {
      mockMatchMedia(false);
      renderSettingsPage();

      fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));
      expect(screen.getByTestId("login-page")).toBeTruthy();
    });

    it("shows login prompt on the Data tab", () => {
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /données & plats/i }));

      expect(screen.getByText(/connectez-vous pour accéder/i)).toBeTruthy();
      expect(mockGetBackups).not.toHaveBeenCalled();
    });

    it("shows login prompt on the Bugs tab", () => {
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /signaler un bug/i }));

      expect(screen.getByText(/connectez-vous pour accéder/i)).toBeTruthy();
      expect(screen.queryByPlaceholderText(/lorsque j'accepte/i)).toBeNull();
    });

    it("shows Jamais for last sync on the Info tab", async () => {
      mockMatchMedia(false);
      renderSettingsPage();
      fireEvent.click(screen.getByRole("button", { name: /à propos/i }));

      await waitFor(() => {
        expect(screen.getByText("Jamais")).toBeTruthy();
      });
      expect(mockGetLastSyncAt).not.toHaveBeenCalled();
    });
  });
});
