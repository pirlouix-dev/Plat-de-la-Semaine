import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import LoginPage from "../pages/LoginPage/LoginPage";

beforeEach(() => {
  localStorage.clear();
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
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
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

  it("shows error message when login fails with invalid credentials", async () => {
    mockFetchError(400, {
      code: "INVALID_CREDENTIALS",
      message: "Email ou mot de passe incorrect",
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "bad@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByText("Se connecter"));

    expect(
      await screen.findByText("Email ou mot de passe incorrect"),
    ).toBeTruthy();
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
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/forgot-password");
    expect(options.body).toBe(JSON.stringify({ email: "user@example.com" }));

    expect(
      await screen.findByText(/un email de réinitialisation a été envoyé/),
    ).toBeTruthy();
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

  it("shows validation error for empty email on forgot password", async () => {
    renderLogin();

    fireEvent.click(
      screen.getByRole("button", { name: /mot de passe oublié/i }),
    );

    expect(
      screen.getByText("Veuillez entrer une adresse email valide."),
    ).toBeTruthy();
  });

  it("shows validation error for invalid email on forgot password", async () => {
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "not-an-email" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /mot de passe oublié/i }),
    );

    expect(
      screen.getByText("Veuillez entrer une adresse email valide."),
    ).toBeTruthy();
  });
});
