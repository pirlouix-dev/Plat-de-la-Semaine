import { useState, useCallback, useEffect } from "react";
import "../App.css";
import "./SettingsPage.css";
import { SETTINGS_SECTIONS, type SectionId } from "./settingsConstants";

// ── Info Section ─────────────────────────────────────────────────────────────

function InfoSection() {
  return (
    <div className="settings-section">
      <h2>Informations pratiques</h2>
      <dl className="info-list">
        <dt>Application</dt>
        <dd>Plat de la Semaine</dd>
        <dt>Version</dt>
        <dd>v0.1.0</dd>
        <dt>Front-end</dt>
        <dd>React + TypeScript + Vite</dd>
        <dt>Back-end</dt>
        <dd>.NET 8 + C#</dd>
        <dt>Base de données</dt>
        <dd>Firebase / Firestore</dd>
      </dl>
    </div>
  );
}

// ── Backups Section ──────────────────────────────────────────────────────────

interface BackupItem {
  id: string;
  label: string;
  createdAt: string;
  dishCount: number;
}

function BackupsSection() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchBackups() {
      try {
        const res = await fetch("/api/backups");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setBackups(json.data ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load backups");
          setLoading(false);
        }
      }
    }

    fetchBackups();
    return () => { cancelled = true; };
  }, []);

  async function handleRestore(backupId: string) {
    setRestoringId(backupId);
    try {
      const res = await fetch(`/api/backups/restore/${backupId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refresh list after restore
      const listRes = await fetch("/api/backups");
      if (listRes.ok) {
        const json = await listRes.json();
        setBackups(json.data ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) return <p className="status-message">Loading backups…</p>;
  if (error) return <p className="status-message status-error">{error}</p>;

  return (
    <div className="settings-section">
      <h2>Restauration des données</h2>
      {backups.length === 0 ? (
        <p className="settings-empty">No backups available.</p>
      ) : (
        <ul className="backup-list">
          {backups.map((b) => (
            <li key={b.id} className="backup-item">
              <div className="backup-info">
                <span className="backup-label">{b.label}</span>
                <span className="backup-meta">
                  {b.dishCount} dish{b.dishCount !== 1 ? "es" : ""} —{" "}
                  {new Date(b.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                className="btn btn-secondary"
                disabled={restoringId === b.id}
                onClick={() => handleRestore(b.id)}
              >
                {restoringId === b.id ? "Restoring…" : "Revenir"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Bug Report Section ───────────────────────────────────────────────────────

function BugReportSection() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "success" | "error">("idle");

  async function handleSubmit() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFeedback("success");
      setMessage("");
    } catch {
      setFeedback("error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="settings-section">
      <h2>Signaler un bug</h2>
      <p className="settings-description">
        Décrivez le problème rencontré ci-dessous.
      </p>
      <textarea
        className="bug-textarea"
        placeholder="Décrivez le bug…"
        rows={6}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          setFeedback("idle");
        }}
      />
      <button
        className="btn btn-primary"
        disabled={sending || !message.trim()}
        onClick={handleSubmit}
      >
        {sending ? "Envoi…" : "Envoyer"}
      </button>
      {feedback === "success" && (
        <p className="settings-success">Merci ! Votre signalement a été envoyé.</p>
      )}
      {feedback === "error" && (
        <p className="status-error">Échec de l&apos;envoi. Veuillez réessayer.</p>
      )}
    </div>
  );
}

// ── Re-sort Section ──────────────────────────────────────────────────────────

function ResortSection() {
  const [sorting, setSorting] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "success" | "error">("idle");

  async function handleResort() {
    setSorting(true);
    try {
      const res = await fetch("/api/dishes/resort", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFeedback("success");
    } catch {
      setFeedback("error");
    } finally {
      setSorting(false);
    }
  }

  return (
    <div className="settings-section">
      <h2>Retrier les plats</h2>
      <p className="settings-description">
        Réorganise la liste des plats par ordre alphabétique.
      </p>
      <button
        className="btn btn-primary"
        disabled={sorting}
        onClick={handleResort}
      >
        {sorting ? "Tri en cours…" : "Retrier les plats"}
      </button>
      {feedback === "success" && (
        <p className="settings-success">Les plats ont été triés avec succès.</p>
      )}
      {feedback === "error" && (
        <p className="status-error">Échec du tri. Veuillez réessayer.</p>
      )}
    </div>
  );
}

// ── Updates Section ──────────────────────────────────────────────────────────

function UpdatesSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isUpToDate, setIsUpToDate] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkVersion() {
      try {
        const res = await fetch("/api/version");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          const currentVersion = "0.1.0";
          const latest = json.data?.latestVersion ?? currentVersion;
          setLatestVersion(latest);
          setIsUpToDate(latest === currentVersion);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to check version");
          setLoading(false);
        }
      }
    }

    checkVersion();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="status-message">Checking for updates…</p>;
  if (error) return <p className="status-message status-error">{error}</p>;

  return (
    <div className="settings-section">
      <h2>Mises à jour</h2>
      {isUpToDate ? (
        <p className="settings-success">
          Vous êtes à jour (v{latestVersion}).
        </p>
      ) : (
        <div>
          <p className="settings-description">
            Une nouvelle version ({latestVersion}) est disponible.
          </p>
          <button className="btn btn-primary">Mettre à jour</button>
        </div>
      )}
    </div>
  );
}

// ── Section content mapper ───────────────────────────────────────────────────

const SECTION_COMPONENTS: Record<SectionId, React.FC> = {
  info: InfoSection,
  backups: BackupsSection,
  bug: BugReportSection,
  resort: ResortSection,
  updates: UpdatesSection,
};

// ── Main Settings Page ───────────────────────────────────────────────────────

function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("info");

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let nextIndex: number | null = null;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        nextIndex = (index + 1) % SETTINGS_SECTIONS.length;
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        nextIndex =
          (index - 1 + SETTINGS_SECTIONS.length) % SETTINGS_SECTIONS.length;
      }

      if (nextIndex !== null) {
        setActiveSection(SETTINGS_SECTIONS[nextIndex].id);
        // Focus the next button
        const buttons = document.querySelectorAll<HTMLElement>(".settings-nav-item");
        buttons[nextIndex]?.focus();
      }
    },
    [],
  );

  const ActiveContent = SECTION_COMPONENTS[activeSection];

  return (
    <div className="app-container settings-container">
      <h1 className="page-title">Paramètres</h1>

      <div className="settings-layout">
        <nav className="settings-nav" role="navigation" aria-label="Settings menu">
          {SETTINGS_SECTIONS.map((section, index) => (
            <button
              key={section.id}
              className={`settings-nav-item ${
                activeSection === section.id ? "active" : ""
              }`}
              aria-current={activeSection === section.id ? "page" : undefined}
              onClick={() => setActiveSection(section.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="settings-content" role="region" aria-label="Settings content">
          <ActiveContent />
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
