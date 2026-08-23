import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost, notifyAuthChange } from "../../services/api";
import type { components } from "../../schema";
import { MailIcon } from "../../components/Icons";
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

  const [showPopup, setShowPopup] = useState(!!location.state?.justRegistered);
  const [idToken, setIdToken] = useState<string | null>(location.state?.idToken ?? null);
  const [cooldown, setCooldown] = useState(location.state?.justRegistered ? 10 : 0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (location.state?.justRegistered) {
      window.history.replaceState({}, "");
    }
  }, [location.state?.justRegistered]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || sending || !idToken) return;
    setSending(true);
    const result = await apiPost<undefined>("/api/auth/send-verification", {
      idToken,
    });
    if (result.ok) {
      setCooldown(10);
    } else {
      setError(result.error.message);
    }
    setSending(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await apiPost<AuthResponse>("/api/auth/login", {
      email,
      password,
    });

    if (result.ok && result.data.emailVerified === false) {
      setIdToken(result.data.idToken);
      setShowPopup(true);
      setCooldown(10);
    } else if (result.ok) {
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

  return (
    <div className="auth-container">
      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-card">
            <button
              className="popup-close"
              onClick={() => setShowPopup(false)}
              aria-label="Fermer"
            >
              ✕
            </button>
            <div className="popup-icon">
              <MailIcon size={56} />
            </div>
            <h2>Vérifiez votre email</h2>
            <p>
              Un email de vérification a été envoyé à <strong>{email}</strong>.
            </p>
            <p className="popup-hint">
              <strong>Il se situe probablement dans vos spams.</strong>
            </p>
            <button
              className="btn btn-primary"
              onClick={handleResend}
              disabled={cooldown > 0 || sending || !idToken}
            >
              {sending
                ? "Envoi..."
                : cooldown > 0
                  ? `Renvoyer (${cooldown}s)`
                  : "Renvoyer l'email"}
            </button>
          </div>
        </div>
      )}

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
