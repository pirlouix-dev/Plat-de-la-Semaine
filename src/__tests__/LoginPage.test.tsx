import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

function renderLogin(options?: { justRegistered?: boolean; email?: string; idToken?: string }) {
  const state = options?.justRegistered
    ? { justRegistered: true, email: options.email ?? "", idToken: options.idToken ?? null }
    : undefined;

  const initialEntries = state
    ? [{ pathname: "/login", state }]
    : ["/login"];

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hides verification popup when close button is clicked", () => {
    renderLogin({ justRegistered: true, email: "test@example.com", idToken: "t" });
    fireEvent.click(screen.getByLabelText("Fermer"));
    expect(screen.queryByText("Vérifiez votre email")).toBeNull();
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
      JSON.stringify({ email: "user@example.com", password: "correct-password" }),
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

    expect(await screen.findByText("Email ou mot de passe incorrect")).toBeTruthy();
  });

  it("shows verification popup when login returns emailVerified false", async () => {
    mockFetchSuccess({ ...AUTH_RESPONSE, emailVerified: false });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "unverified@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "pwd" },
    });
    fireEvent.click(screen.getByText("Se connecter"));

    expect(await screen.findByText("Vérifiez votre email")).toBeTruthy();
  });

  it("enables resend after cooldown and sends verification with the login idToken", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue({ ...AUTH_RESPONSE, idToken: "login-id-token", emailVerified: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "unverified@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mot de passe"), {
      target: { value: "pwd" },
    });
    fireEvent.click(screen.getByText("Se connecter"));

    await act(async () => {});

    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    fireEvent.click(screen.getByText("Renvoyer l'email"));

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/api/auth/send-verification");
    expect(options.body).toBe(JSON.stringify({ idToken: "login-id-token" }));

    vi.useRealTimers();
  });

  it("calls /api/auth/send-verification when resend button is clicked", async () => {
    vi.useFakeTimers();
    mockFetchSuccess({});

    renderLogin({ justRegistered: true, email: "test@example.com", idToken: "resend-token" });

    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    fireEvent.click(screen.getByText("Renvoyer l'email"));

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/send-verification");
    expect(options.body).toBe(JSON.stringify({ idToken: "resend-token" }));

    vi.useRealTimers();
  });

  it("starts cooldown again after resend", async () => {
    vi.useFakeTimers();
    mockFetchSuccess({});

    renderLogin({ justRegistered: true, email: "test@example.com", idToken: "cooldown-token" });

    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    fireEvent.click(screen.getByText("Renvoyer l'email"));

    vi.useRealTimers();
    await vi.waitFor(() => {
      expect(screen.getByText(/Renvoyer \(10s\)/)).toBeDisabled();
    });
  });
});
