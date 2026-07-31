import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";
import type { components } from "../schema";
import logo_img from "../../assets/logo.png";
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

    navigate("/login", {
      state: { justRegistered: true, email, idToken: result.data.idToken },
    });
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
        <div className="input-group">
          <input
            type="text"
            className="modern-input"
            placeholder="Nom d'utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
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
            className="btn btn-green"
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
