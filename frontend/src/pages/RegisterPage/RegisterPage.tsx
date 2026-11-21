import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import CharacterCounter from "../../components/CharacterCounter";
import PasswordInput from "../../components/PasswordInput";
import { apiPost, notifyAuthChange } from "../../services/api";
import { MAX_USERNAME_LENGTH } from "../../types";
import type { components } from "../../schema";
import { useApiErrorToast } from "../../hooks/useApiErrorToast";
import { useWarmupPing } from "../../hooks/useWarmupPing";
import { useTranslation } from "../../i18n";
import logo_img from "../../../assets/logo.png";
import "../../styles/auth.css";

type AuthResponse = components["schemas"]["AuthResponse"];

const MIN_PASSWORD_LENGTH = 6;

function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const showApiErrorToast = useApiErrorToast();
  const { t } = useTranslation();

  const passwordsMatch = password === confirmPassword;
  const showMismatch = confirmPassword.length > 0 && !passwordsMatch;
  const passwordTooShort = password.length < MIN_PASSWORD_LENGTH;

  useWarmupPing();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordTooShort || !passwordsMatch) {
      return;
    }

    setLoading(true);

    const result = await apiPost<AuthResponse>("/api/auth/register", {
      username,
      email,
      password,
    });

    if (!result.ok) {
      showApiErrorToast(result.error);
      setLoading(false);
      return;
    }

    localStorage.setItem("auth_token", result.data.idToken);
    localStorage.setItem("refresh_token", result.data.refreshToken);
    localStorage.setItem("user_id", result.data.userId);
    localStorage.setItem("user_username", result.data.username);
    localStorage.setItem(
      "token_expiry",
      String(Date.now() + Number(result.data.expiresIn) * 1000),
    );
    notifyAuthChange();
    navigate("/");
  };

  return (
    <div className="auth-container">
      <div className="auth-logo-wrapper">
        <img src={logo_img} alt="Plat de la Semaine" className="auth-logo" />
      </div>

      <h1 className="auth-title">{t("register.title")}</h1>

      <p className="auth-switch">
        {t("register.haveAccount")}{" "}
        <Link to="/login">{t("register.loginLink")}</Link>
      </p>

      <form className="dish-form" onSubmit={handleRegister}>
        <div className="input-group char-counter-field">
          <input
            type="text"
            className="modern-input"
            placeholder={t("register.username")}
            autoComplete="nickname"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={MAX_USERNAME_LENGTH}
            required
          />
          <CharacterCounter value={username} maxLength={MAX_USERNAME_LENGTH} />
        </div>

        <div className="input-group">
          <input
            type="email"
            className="modern-input"
            placeholder={t("register.email")}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <PasswordInput
            placeholder={t("register.password")}
            showLabel={t("common.showPassword")}
            hideLabel={t("common.hidePassword")}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>

        <div className="input-group">
          <PasswordInput
            placeholder={t("register.confirmPassword")}
            showLabel={t("common.showPasswordConfirmation")}
            hideLabel={t("common.hidePasswordConfirmation")}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
          {showMismatch && (
            <span className="input-feedback">
              {t("register.passwordMismatch")}
            </span>
          )}
        </div>

        <div className="auth-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || passwordTooShort || !passwordsMatch}
          >
            {loading ? t("register.submitting") : t("register.submit")}
          </button>
          <button
            type="button"
            className="auth-link-btn"
            onClick={() => navigate("/")}
          >
            {t("login.continueWithoutAccount")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default RegisterPage;
