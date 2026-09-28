import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost, notifyAuthChange } from "../../services/api";
import type { components } from "../../schema";
import { useToast } from "../../components/toastContext";
import { useWarmupPing } from "../../hooks/useWarmupPing";
import logo_img from "../../../assets/logo.png";
import "./LoginPage.css";

type AuthResponse = components["schemas"]["AuthResponse"];

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const [forgotLoading, setForgotLoading] = useState(false);

  useWarmupPing();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await apiPost<AuthResponse>("/api/auth/login", {
      email,
      password,
    });

    if (result.ok) {
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
    } else {
      setError(result.error.message ?? "Une erreur est survenue.");
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Veuillez entrer une adresse email valide.");
      return;
    }
    setError(null);
    setForgotLoading(true);
    const result = await apiPost<undefined>("/api/auth/forgot-password", {
      email,
    });
    if (result.ok) {
      showToast(
        "Si ce compte existe, un email de réinitialisation a été envoyé.",
        "success",
        7000,
      );
    } else {
      showToast(result.error.message ?? "Une erreur est survenue.", "error");
    }
    setForgotLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="register-logo-wrapper">
        <img
          src={logo_img}
          alt="Plat de la Semaine"
          className="register-logo"
        />
      </div>

      <h1 className="auth-title">Connexion</h1>

      <form className="dish-form" onSubmit={handleLogin}>
        <div className="input-group">
          <input
            type="email"
            className="modern-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <input
            type="password"
            className="modern-input"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="forgot-password-container">
            <button
              type="button"
              className="forgot-password-link"
              onClick={handleForgotPassword}
              disabled={forgotLoading}
            >
              {forgotLoading ? "Envoi en cours…" : "Mot de passe oublié ?"}
            </button>
          </div>
        </div>

        {error && <div className="register-error">{error}</div>}

        <div className="register-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={() => navigate("/register")}
          >
            Créer un compte
          </button>
          <button
            type="button"
            className="register-link-btn"
            onClick={() => navigate("/")}
          >
            Continuer sans compte
          </button>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;
