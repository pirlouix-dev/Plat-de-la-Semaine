import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RegisterPage from "../pages/RegisterPage/RegisterPage";
import { MAX_USERNAME_LENGTH } from "../types";

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
      <RegisterPage />
    </MemoryRouter>,
  );
}

describe("RegisterPage", () => {
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

    fireEvent.click(screen.getByText("S'inscrire"));

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/register");
    expect(options.body).toBe(
      JSON.stringify({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      }),
    );
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

  it("shows error message when registration fails", async () => {
    mockFetchError(400, {
      code: "VALIDATION_ERROR",
      message: "Email already in use",
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

    fireEvent.click(screen.getByText("S'inscrire"));

    expect(await screen.findByText("Email already in use")).toBeTruthy();
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

    fireEvent.click(screen.getByText("S'inscrire"));

    expect(screen.getByText("Inscription...")).toBeDisabled();
  });
});
