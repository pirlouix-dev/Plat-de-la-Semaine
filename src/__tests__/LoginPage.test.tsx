import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import LoginPage from "../pages/LoginPage/LoginPage";
import { SERVER_WARMUP_MESSAGE } from "../services/api";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    }),
  );
});

const AUTH_RESPONSE = {
  idToken: "token-123",
  refreshToken: "refresh-abc",
  expiresIn: "3600",
  userId: "user-42",
  username: "Mathéo",
};

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

function mockFetchError(
  status: number,
  body: { code: string; message: string },
) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: vi.fn().mockResolvedValue(body),
    }),
  );
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <ToastProvider>
        <LoginPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls /api/auth/login with email and password on submit", async () => {
    mockFetchSuccess(AUTH_RESPONSE);

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "correct-password" },
    });

    fireEvent.click(screen.getByText("Se connecter"));

    const fetchMock = vi.mocked(fetch);
    const loginCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/api/auth/login"),
    );
    expect(loginCall).toBeTruthy();

    const [url, options] = loginCall as [string, RequestInit];
    expect(url).toContain("/api/auth/login");
    expect(options.body).toBe(
      JSON.stringify({
        email: "user@example.com",
        password: "correct-password",
      }),
    );
  });

  it("stores auth tokens on successful login", async () => {
    mockFetchSuccess(AUTH_RESPONSE);

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "pwd" },
    });
    fireEvent.click(screen.getByText("Se connecter"));

    await vi.waitFor(() => {
      expect(localStorage.getItem("auth_token")).toBe("token-123");
      expect(localStorage.getItem("refresh_token")).toBe("refresh-abc");
      expect(localStorage.getItem("user_id")).toBe("user-42");
      expect(localStorage.getItem("user_username")).toBe("Mathéo");
      const tokenExpiry = localStorage.getItem("token_expiry");
      expect(tokenExpiry).toBeTruthy();
      expect(Number(tokenExpiry)).toBeGreaterThan(Date.now());
    });
  });

  it("shows a friendly toast and clears the password when credentials are rejected", async () => {
    mockFetchError(401, {
      code: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect.",
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "bad@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByText("Se connecter"));

    const toast = await screen.findByText("Email ou mot de passe incorrect.");
    expect(toast.className).toContain("toast-error");
    expect(screen.queryByText("INVALID_CREDENTIALS")).toBeNull();
    expect(screen.queryByText("Email or password is incorrect.")).toBeNull();
    expect(document.querySelector(".auth-error")).toBeNull();

    expect(screen.getByPlaceholderText("Mot de passe")).toHaveValue("");
    expect(screen.getByPlaceholderText("Email")).toHaveValue("bad@example.com");
  });

  it("shows a generic French message for an unknown auth code", async () => {
    mockFetchError(401, {
      code: "SOMETHING_NEW",
      message: "SOMETHING_NEW",
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "pwd" },
    });
    fireEvent.click(screen.getByText("Se connecter"));

    const toast = await screen.findByText("Une erreur est survenue.");
    expect(toast.className).toContain("toast-error");
    expect(screen.queryByText("SOMETHING_NEW")).toBeNull();
    expect(screen.getByPlaceholderText("Mot de passe")).toHaveValue("pwd");
  });

  it("shows the warm-up message instead of the raw timeout error on login", async () => {
    mockFetchError(408, {
      code: "TIMEOUT",
      message: "Request timed out",
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "pwd" },
    });
    fireEvent.click(screen.getByText("Se connecter"));

    const toast = await screen.findByText(SERVER_WARMUP_MESSAGE);
    expect(toast.className).toContain("toast-error");
    expect(screen.queryByText("Request timed out")).toBeNull();
    expect(screen.getByPlaceholderText("Mot de passe")).toHaveValue("pwd");
  });

  it("shows the warm-up toast when forgot-password times out", async () => {
    mockFetchError(408, {
      code: "TIMEOUT",
      message: "Request timed out",
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "user@example.com" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /mot de passe oublié/i }),
    );

    const toast = await screen.findByText(SERVER_WARMUP_MESSAGE);
    expect(toast.className).toContain("toast-error");
  });

  it("calls /api/auth/forgot-password with email and shows success toast", async () => {
    mockFetchSuccess({});

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "user@example.com" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /mot de passe oublié/i }),
    );

    const fetchMock = vi.mocked(fetch);
    const forgotCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/api/auth/forgot-password"),
    );
    expect(forgotCall).toBeTruthy();

    const [url, options] = forgotCall as [string, RequestInit];
    expect(url).toContain("/api/auth/forgot-password");
    expect(options.body).toBe(JSON.stringify({ email: "user@example.com" }));

    const toast = await screen.findByText(
      /un email de réinitialisation a été envoyé/,
    );
    expect(toast.className).toContain("toast-warning");
  });

  it("disables forgot-password button while request is in flight", async () => {
    let resolveFetch!: (v: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((r) => {
            resolveFetch = r;
          }),
      ),
    );

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "user@example.com" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /mot de passe oublié/i }),
    );

    const button = screen.getByRole("button", { name: /envoi en cours/i });
    expect(button).toBeDisabled();

    resolveFetch({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    await vi.waitFor(() => {
      expect(
        screen.getByRole("button", { name: /mot de passe oublié/i }),
      ).not.toBeDisabled();
    });
  });

  it("shows a validation toast for empty email on forgot password", () => {
    renderLogin();

    fireEvent.click(
      screen.getByRole("button", { name: /mot de passe oublié/i }),
    );

    const toast = screen.getByText("Veuillez entrer une adresse email valide.");
    expect(toast.className).toContain("toast-error");
    expect(document.querySelector(".auth-error")).toBeNull();
  });

  it("shows a validation toast for invalid email on forgot password", () => {
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "not-an-email" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /mot de passe oublié/i }),
    );

    const toast = screen.getByText("Veuillez entrer une adresse email valide.");
    expect(toast.className).toContain("toast-error");
  });

  it("links to the register page with a single switch affordance", () => {
    renderLogin();

    const switchLink = screen.getByRole("link", { name: "S'inscrire" });
    expect(switchLink).toHaveAttribute("href", "/register");
    expect(
      screen.queryByRole("button", { name: /créer un compte/i }),
    ).toBeNull();
  });

  it("pings the backend on mount to warm it up", async () => {
    renderLogin();

    await vi.waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes("/api/ping"),
        ),
      ).toBe(true);
    });
  });
});
