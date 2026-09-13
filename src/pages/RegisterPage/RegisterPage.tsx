import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CharacterCounter from "../../components/CharacterCounter";
import { apiPost, notifyAuthChange } from "../../services/api";
import { MAX_USERNAME_LENGTH } from "../../types";
import type { components } from "../../schema";
import logo_img from "../../../assets/logo.png";
import "./RegisterPage.css";

type AuthResponse = components["schemas"]["AuthResponse"];

function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await apiPost<AuthResponse>("/api/auth/register", {
      username,
      email,
      password,
    });

    if (!result.ok) {
      setError(result.error.message);
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
      <div className="register-logo-wrapper">
        <img
          src={logo_img}
          alt="Plat de la Semaine"
          className="register-logo"
        />
      </div>

      <h1 className="auth-title">Inscription</h1>

      <form className="dish-form" onSubmit={handleRegister}>
        <div className="input-group char-counter-field">
          <input
            type="text"
            className="modern-input"
            placeholder="Nom d'utilisateur"
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
            minLength={6}
          />
        </div>

        {error && <div className="register-error">{error}</div>}

        <div className="register-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Inscription..." : "S'inscrire"}
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={() => navigate("/login")}
          >
            Se connecter
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

export default RegisterPage;
