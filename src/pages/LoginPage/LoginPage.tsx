import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  apiPost,
  isInvalidCredentialsError,
  notifyAuthChange,
} from "../../services/api";
import type { components } from "../../schema";
import { useToast } from "../../components/toastContext";
import { useApiErrorToast } from "../../hooks/useApiErrorToast";
import { useWarmupPing } from "../../hooks/useWarmupPing";
import logo_img from "../../../assets/logo.png";
import "../../styles/auth.css";
import "./LoginPage.css";

type AuthResponse = components["schemas"]["AuthResponse"];

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.email ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const showApiErrorToast = useApiErrorToast();
  const [forgotLoading, setForgotLoading] = useState(false);

  useWarmupPing();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
      showApiErrorToast(result.error);
      if (isInvalidCredentialsError(result.error)) {
        setPassword("");
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("Veuillez entrer une adresse email valide.", "error");
      return;
    }
    setForgotLoading(true);
    const result = await apiPost<undefined>("/api/auth/forgot-password", {
      email,
    });
    if (result.ok) {
      showToast(
        "Si ce compte existe, un email de réinitialisation a été envoyé. Il se situe probablement dans vos spams.",
        "warning",
      );
    } else {
      showApiErrorToast(result.error);
    }
    setForgotLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-logo-wrapper">
        <img src={logo_img} alt="Plat de la Semaine" className="auth-logo" />
      </div>

      <h1 className="auth-title">Connexion</h1>

      <p className="auth-switch">
        Vous souhaitez créer un compte ? <Link to="/register">S'inscrire</Link>
      </p>

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

        <div className="auth-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
          <button
            type="button"
            className="auth-link-btn"
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
