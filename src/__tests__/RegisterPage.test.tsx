import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import RegisterPage from "../pages/RegisterPage/RegisterPage";
import { MAX_USERNAME_LENGTH } from "../types";
import { SERVER_WARMUP_MESSAGE } from "../services/api";

function mockFetchSuccess(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(body),
    }),
  );
}

function mockFetchError(status: number, body: { code: string; message: string }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: vi.fn().mockResolvedValue(body),
    }),
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <RegisterPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      }),
    );
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("caps the username input at MAX_USERNAME_LENGTH", () => {
    renderPage();
    expect(screen.getByPlaceholderText("Nom d'utilisateur")).toHaveAttribute(
      "maxLength",
      String(MAX_USERNAME_LENGTH),
    );
  });

  it("shows the character counter only when the username nears the limit", () => {
    renderPage();
    const usernameInput = screen.getByPlaceholderText("Nom d'utilisateur");

    expect(screen.queryByText(/^\d+\/100$/)).toBeNull();

    fireEvent.change(usernameInput, { target: { value: "a".repeat(80) } });
    expect(screen.getByText("80/100")).toBeTruthy();

    fireEvent.change(usernameInput, { target: { value: "a".repeat(50) } });
    expect(screen.queryByText(/^\d+\/100$/)).toBeNull();
  });

  it("calls /api/auth/register with username, email, password on submit", async () => {
    mockFetchSuccess({
      idToken: "token-123",
      refreshToken: "refresh-abc",
      expiresIn: "3600",
      userId: "user-42",
      username: "testuser",
    });

    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmer le mot de passe"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByText("S'inscrire"));

    const fetchMock = vi.mocked(fetch);
    const registerCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/api/auth/register"),
    );
    expect(registerCall).toBeTruthy();

    const [url, options] = registerCall as [string, RequestInit];
    expect(url).toContain("/api/auth/register");
    expect(options.body).toBe(
      JSON.stringify({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      }),
    );
  });

  it("disables submit and does not register when the passwords do not match", () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmer le mot de passe"), {
      target: { value: "password124" },
    });

    const submit = screen.getByText("S'inscrire");
    expect(submit).toBeDisabled();

    fireEvent.click(submit);

    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/auth/register"),
      ),
    ).toBe(false);
    expect(
      screen.getByText("Les mots de passe ne correspondent pas."),
    ).toBeTruthy();
  });

  it("enables submit once the passwords match", () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmer le mot de passe"), {
      target: { value: "password124" },
    });

    expect(screen.getByText("S'inscrire")).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Confirmer le mot de passe"), {
      target: { value: "password123" },
    });

    expect(screen.queryByText("Les mots de passe ne correspondent pas.")).toBeNull();
    expect(screen.getByText("S'inscrire")).toBeEnabled();
  });

  it("disables submit until the password reaches the minimum length", () => {
    renderPage();

    const passwordInput = screen.getByPlaceholderText("Mot de passe");
    const confirmInput = screen.getByPlaceholderText("Confirmer le mot de passe");

    fireEvent.change(passwordInput, { target: { value: "abc" } });
    fireEvent.change(confirmInput, { target: { value: "abc" } });

    expect(screen.getByText("S'inscrire")).toBeDisabled();

    fireEvent.change(passwordInput, { target: { value: "abcdef" } });
    fireEvent.change(confirmInput, { target: { value: "abcdef" } });

    expect(screen.getByText("S'inscrire")).toBeEnabled();
  });

  it("stores auth tokens after successful registration", async () => {
    mockFetchSuccess({
      idToken: "token-123",
      refreshToken: "refresh-abc",
      expiresIn: "3600",
      userId: "user-42",
      username: "testuser",
    });

    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmer le mot de passe"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByText("S'inscrire"));

    await vi.waitFor(() => {
      expect(localStorage.getItem("auth_token")).toBe("token-123");
      expect(localStorage.getItem("refresh_token")).toBe("refresh-abc");
      expect(localStorage.getItem("user_id")).toBe("user-42");
      expect(localStorage.getItem("user_username")).toBe("testuser");
      const tokenExpiry = localStorage.getItem("token_expiry");
      expect(tokenExpiry).toBeTruthy();
      expect(Number(tokenExpiry)).toBeGreaterThan(Date.now());
    });
  });

  it("shows a French error toast when the email is already used", async () => {
    mockFetchError(400, {
      code: "EMAIL_EXISTS",
      message: "An account already exists for this email address.",
    });

    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"), {
      target: { value: "existinguser" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "taken@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmer le mot de passe"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByText("S'inscrire"));

    const toast = await screen.findByText(
      "Un compte existe déjà avec cette adresse email.",
    );
    expect(toast.className).toContain("toast-error");
    expect(screen.queryByText("EMAIL_EXISTS")).toBeNull();
    expect(
      screen.queryByText("An account already exists for this email address."),
    ).toBeNull();
    expect(document.querySelector(".auth-error")).toBeNull();
  });

  it("shows a generic French message for an unknown registration code", async () => {
    mockFetchError(400, {
      code: "SOMETHING_NEW",
      message: "SOMETHING_NEW",
    });

    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"), {
      target: { value: "existinguser" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "taken@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmer le mot de passe"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByText("S'inscrire"));

    const toast = await screen.findByText("Une erreur est survenue.");
    expect(toast.className).toContain("toast-error");
    expect(screen.queryByText("SOMETHING_NEW")).toBeNull();
  });

  it("shows the warm-up message instead of the raw timeout error on register", async () => {
    mockFetchError(408, {
      code: "TIMEOUT",
      message: "Request timed out",
    });

    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmer le mot de passe"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByText("S'inscrire"));

    const toast = await screen.findByText(SERVER_WARMUP_MESSAGE);
    expect(toast.className).toContain("toast-error");
    expect(screen.queryByText("Request timed out")).toBeNull();
  });

  it("disables submit button and shows loading text while registering", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"), {
      target: { value: "user" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmer le mot de passe"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByText("S'inscrire"));

    expect(screen.getByText("Inscription...")).toBeDisabled();
  });

  it("links to the login page with a single switch affordance", () => {
    renderPage();

    const switchLink = screen.getByRole("link", { name: "Se connecter" });
    expect(switchLink).toHaveAttribute("href", "/login");
    expect(
      screen.queryByRole("button", { name: /^se connecter$/i }),
    ).toBeNull();
  });

  it("pings the backend on mount to warm it up", async () => {
    renderPage();

    await vi.waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("/api/ping")),
      ).toBe(true);
    });
  });
});
