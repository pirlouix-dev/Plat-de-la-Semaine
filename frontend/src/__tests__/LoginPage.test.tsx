import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import LoginPage from "../pages/LoginPage/LoginPage";
import { createTranslator } from "../i18n";

const t = createTranslator("en");

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

    fireEvent.change(screen.getByPlaceholderText(t("login.email")), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(t("login.password")), {
      target: { value: "correct-password" },
    });

    fireEvent.click(screen.getByRole("button", { name: t("login.submit") }));

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

    fireEvent.change(screen.getByPlaceholderText(t("login.email")), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(t("login.password")), {
      target: { value: "pwd" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("login.submit") }));

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

    fireEvent.change(screen.getByPlaceholderText(t("login.email")), {
      target: { value: "bad@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(t("login.password")), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("login.submit") }));

    const toast = await screen.findByText(t("errors.invalidCredentials"));
    expect(toast.className).toContain("toast-error");
    expect(screen.queryByText("INVALID_CREDENTIALS")).toBeNull();
    expect(screen.queryByText("Email or password is incorrect.")).toBeNull();
    expect(document.querySelector(".auth-error")).toBeNull();

    expect(screen.getByPlaceholderText(t("login.password"))).toHaveValue("");
    expect(screen.getByPlaceholderText(t("login.email"))).toHaveValue("bad@example.com");
  });

  it("shows a generic localised message for an unknown auth code", async () => {
    mockFetchError(401, {
      code: "SOMETHING_NEW",
      message: "SOMETHING_NEW",
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(t("login.email")), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(t("login.password")), {
      target: { value: "pwd" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("login.submit") }));

    const toast = await screen.findByText(t("errors.generic"));
    expect(toast.className).toContain("toast-error");
    expect(screen.queryByText("SOMETHING_NEW")).toBeNull();
    expect(screen.getByPlaceholderText(t("login.password"))).toHaveValue("pwd");
  });

  it("shows the warm-up message instead of the raw timeout error on login", async () => {
    mockFetchError(408, {
      code: "TIMEOUT",
      message: "Request timed out",
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(t("login.email")), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(t("login.password")), {
      target: { value: "pwd" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("login.submit") }));

    const toast = await screen.findByText(t("errors.serverWarmup"));
    expect(toast.className).toContain("toast-error");
    expect(screen.queryByText("Request timed out")).toBeNull();
    expect(screen.getByPlaceholderText(t("login.password"))).toHaveValue("pwd");
  });

  it("shows the warm-up toast when forgot-password times out", async () => {
    mockFetchError(408, {
      code: "TIMEOUT",
      message: "Request timed out",
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(t("login.email")), {
      target: { value: "user@example.com" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: t("login.forgotPassword") }),
    );

    const toast = await screen.findByText(t("errors.serverWarmup"));
    expect(toast.className).toContain("toast-error");
  });

  it("calls /api/auth/forgot-password with email and shows success toast", async () => {
    mockFetchSuccess({});

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(t("login.email")), {
      target: { value: "user@example.com" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: t("login.forgotPassword") }),
    );

    const fetchMock = vi.mocked(fetch);
    const forgotCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/api/auth/forgot-password"),
    );
    expect(forgotCall).toBeTruthy();

    const [url, options] = forgotCall as [string, RequestInit];
    expect(url).toContain("/api/auth/forgot-password");
    expect(options.body).toBe(JSON.stringify({ email: "user@example.com" }));

    const toast = await screen.findByText(t("login.resetSent"));
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

    fireEvent.change(screen.getByPlaceholderText(t("login.email")), {
      target: { value: "user@example.com" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: t("login.forgotPassword") }),
    );

    const button = screen.getByRole("button", { name: t("login.sending") });
    expect(button).toBeDisabled();

    resolveFetch({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    await vi.waitFor(() => {
      expect(
        screen.getByRole("button", { name: t("login.forgotPassword") }),
      ).not.toBeDisabled();
    });
  });

  it("shows a validation toast for empty email on forgot password", () => {
    renderLogin();

    fireEvent.click(
      screen.getByRole("button", { name: t("login.forgotPassword") }),
    );

    const toast = screen.getByText(t("login.invalidEmail"));
    expect(toast.className).toContain("toast-error");
    expect(document.querySelector(".auth-error")).toBeNull();
  });

  it("shows a validation toast for invalid email on forgot password", () => {
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(t("login.email")), {
      target: { value: "not-an-email" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: t("login.forgotPassword") }),
    );

    const toast = screen.getByText(t("login.invalidEmail"));
    expect(toast.className).toContain("toast-error");
  });

  it("links to the register page with a single switch affordance", () => {
    renderLogin();

    const switchLink = screen.getByRole("link", { name: t("login.registerLink") });
    expect(switchLink).toHaveAttribute("href", "/register");
    expect(
      screen.queryByRole("button", { name: t("login.noAccount") }),
    ).toBeNull();
  });

  it("toggles the password visibility without submitting the form", () => {
    renderLogin();

    const passwordInput = screen.getByPlaceholderText(t("login.password"));
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");

    fireEvent.change(passwordInput, { target: { value: "secret-password" } });

    fireEvent.click(
      screen.getByRole("button", { name: t("common.showPassword") }),
    );

    const revealedInput = screen.getByPlaceholderText(t("login.password"));
    expect(revealedInput).toHaveAttribute("type", "text");
    expect(revealedInput).toHaveValue("secret-password");

    fireEvent.click(
      screen.getByRole("button", { name: t("common.hidePassword") }),
    );

    expect(screen.getByPlaceholderText(t("login.password"))).toHaveAttribute(
      "type",
      "password",
    );
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) =>
        String(url).includes("/api/auth/login"),
      ),
    ).toBe(false);
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
