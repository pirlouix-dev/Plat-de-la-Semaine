import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ComponentType,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BackArrowIcon,
  BugIcon,
  InfoIcon,
  RefreshIcon,
  UserIcon,
} from "../../components/Icons";
import CharacterCounter from "../../components/CharacterCounter";
import { useDatabase } from "../../db/DatabaseContext";
import { useToast } from "../../components/toastContext";
import { getBackups, restoreBackup } from "../../services/backupService";
import { importDishes } from "../../services/dishService";
import { getVersionInfo, submitFeedback } from "../../services/settingsService";
import { getLastSyncAt, refreshFromServer } from "../../services/syncService";
import {
  insertManyDishes,
  buildPendingDishes,
  getAllDishes,
} from "../../repositories/dishRepository";
import { parseDishImportJson } from "../../utils/validateDishImport";
import {
  buildExportFilename,
  downloadJsonFile,
  serializeDishExport,
} from "../../utils/dishExport";
import {
  updateUsername,
  resetPassword,
  deleteAccount,
} from "../../services/authService";
import { clearAuth } from "../../services/api";
import { useIsLoggedIn } from "../../hooks/useIsLoggedIn";
import { MAX_FEEDBACK_LENGTH, MAX_USERNAME_LENGTH } from "../../types/dish";
import type { BackupSummary } from "../../types";
import type { VersionInfo } from "../../services/settingsService";
import "./SettingsPage.css";

type SettingsTab = "account" | "data" | "bugs" | "info";

// Must match the CSS media query in SettingsPage.css
const MOBILE_LAYOUT_QUERY = "(max-width: 649px)";

const TAB_CONFIG: Record<
  SettingsTab,
  { title: string; Icon: ComponentType<{ size?: number }> }
> = {
  account: { title: "Mon compte", Icon: UserIcon },
  data: { title: "Données & Plats", Icon: RefreshIcon },
  bugs: { title: "Signaler un bug", Icon: BugIcon },
  info: { title: "À propos", Icon: InfoIcon },
};

const SETTINGS_TABS = Object.keys(TAB_CONFIG) as SettingsTab[];

function parseTabHash(hash: string): SettingsTab | null {
  const value = hash.replace(/^#/, "");
  return (SETTINGS_TABS as string[]).includes(value)
    ? (value as SettingsTab)
    : null;
}

function formatBackupDate(isoDate: string): {
  dateLabel: string;
  timeLabel: string;
} {
  const d = new Date(isoDate);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const timeLabel = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) {
    return { dateLabel: "Aujourd'hui", timeLabel };
  }

  const dateLabel = d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return { dateLabel, timeLabel };
}

function formatLastSync(isoDate: string | null): string {
  if (!isoDate) return "Jamais";
  const d = new Date(isoDate);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LoginPrompt() {
  const navigate = useNavigate();
  return (
    <div className="settings-panel">
      <section className="settings-section-card">
        <p className="section-description-login">
          Connectez-vous pour accéder à cette section.
        </p>
        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={() => navigate("/login")}
          >
            Se connecter
          </button>
        </div>
      </section>
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { db } = useDatabase();
  const { showToast } = useToast();
  const isLoggedIn = useIsLoggedIn();

  const isMobileLayout = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
  const activeTab: SettingsTab | null =
    parseTabHash(location.hash) ?? (isMobileLayout ? null : "account");

  const [username, setUsername] = useState(
    () => localStorage.getItem("user_username") ?? "",
  );
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleUsernameSave = async () => {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length > MAX_USERNAME_LENGTH) return;
    setUsernameSaving(true);
    const result = await updateUsername(trimmed);
    if (result.ok) {
      localStorage.setItem("user_username", trimmed);
      showToast("Nom d'utilisateur mis à jour", "success");
    } else {
      showToast(result.error.message, "error");
    }
    setUsernameSaving(false);
  };

  const handleResetPassword = async () => {
    setResettingPassword(true);
    const result = await resetPassword();
    if (result.ok) {
      showToast(
        "Email de réinitialisation envoyé. Il se situe probablement dans vos spams.",
        "warning",
      );
    } else {
      showToast(result.error.message, "error");
    }
    setResettingPassword(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const result = await deleteAccount();
    if (result.ok) {
      clearAuth();
      navigate("/", { replace: true });
    } else {
      showToast(result.error.message, "error");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;

    setImporting(true);
    try {
      let text: string;
      try {
        text = await file.text();
      } catch {
        showToast("Impossible de lire le fichier.", "error");
        return;
      }

      const parsed = parseDishImportJson(text);
      if (!parsed.ok) {
        showToast(parsed.error, "error");
        return;
      }

      if (parsed.items.length === 0) {
        showToast("Aucun plat valide dans le fichier.", "error");
        return;
      }

      try {
        const offline = !navigator.onLine;
        let imported: number;
        let failed = 0;
        if (offline) {
          if (!db) throw new Error("Database not ready");
          await insertManyDishes(db, buildPendingDishes(parsed.items));
          imported = parsed.items.length;
        } else {
          const result = await importDishes(parsed.items);
          if (!result.ok) {
            showToast(result.error.message, "error");
            return;
          }
          if (db) {
            await refreshFromServer(db);
          }
          imported = Number(result.data.imported);
          failed = Number(result.data.failed);
        }

        const rejected = parsed.errors.length + failed;
        const parts = offline
          ? [`${imported} plat(s) enregistré(s) localement`]
          : [`${imported} plat(s) importé(s)`];
        if (rejected > 0) parts.push(`${rejected} en échec`);
        showToast(parts.join(", "), rejected > 0 ? "error" : "success");
      } catch {
        showToast("Erreur lors de l'import", "error");
      }
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    if (!db) return;

    setExporting(true);
    try {
      const dishes = await getAllDishes(db);
      const exportable = dishes.filter((dish) => !dish.isDeleted);
      if (exportable.length === 0) {
        showToast("Aucun plat à exporter.", "error");
        return;
      }

      downloadJsonFile(buildExportFilename(), serializeDishExport(dishes));
      showToast(`${exportable.length} plat(s) exporté(s)`, "success");
    } catch {
      showToast("Erreur lors de l'export", "error");
    } finally {
      setExporting(false);
    }
  };

  const currentTab = activeTab ?? "account";

  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsError, setBackupsError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setBackupsLoading(true);
    setBackupsError(null);
    const result = await getBackups();
    if (result.ok) {
      setBackups(result.data);
    } else {
      setBackupsError(result.error.message);
    }
    setBackupsLoading(false);
  }, []);

  const handleRestore = async (backupId: string) => {
    setRestoringId(backupId);
    const result = await restoreBackup(backupId);
    if (result.ok) {
      showToast("Sauvegarde restaurée avec succès", "success");
      await fetchBackups();
    } else {
      showToast(result.error.message, "error");
    }
    setRestoringId(null);
  };

  const [bugDescription, setBugDescription] = useState("");
  const [bugSubmitting, setBugSubmitting] = useState(false);

  const handleBugSubmit = async () => {
    if (!bugDescription.trim()) return;
    setBugSubmitting(true);
    const result = await submitFeedback({
      message: bugDescription.trim(),
      appVersion: versionInfo?.latestVersion ?? "unknown",
    });
    if (result.ok) {
      showToast("Rapport envoyé, merci !", "success");
      setBugDescription("");
    } else {
      showToast(result.error.message, "error");
    }
    setBugSubmitting(false);
  };

  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVersionInfo().then((result) => {
      if (!cancelled && result.ok) {
        setVersionInfo(result.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentTab !== "data" || backups.length > 0 || !isLoggedIn) return;
    let cancelled = false;
    const load = async () => {
      setBackupsLoading(true);
      setBackupsError(null);
      const result = await getBackups();
      if (cancelled) return;
      if (result.ok) {
        setBackups(result.data);
      } else {
        setBackupsError(result.error.message);
      }
      setBackupsLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentTab, backups.length, isLoggedIn]);

  useEffect(() => {
    if (currentTab !== "info") return;
    let cancelled = false;
    if (isLoggedIn && db) {
      getLastSyncAt(db).then((iso) => {
        if (!cancelled) {
          setLastSyncAt(iso);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [currentTab, db, isLoggedIn]);

  const handleSelectTab = (tab: SettingsTab) => {
    navigate(
      { pathname: location.pathname, hash: `#${tab}` },
      { replace: !isMobileLayout },
    );
  };

  const handleBack = () => {
    if (isMobileLayout && activeTab !== null) {
      // A deep link (initial entry) has nothing to pop, so replace instead.
      if (location.key === "default") {
        navigate({ pathname: location.pathname, hash: "" }, { replace: true });
      } else {
        navigate(-1);
      }
    } else {
      navigate("/");
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/", { replace: true });
  };

  return (
    <div
      className={`settings-container ${activeTab ? "has-active-tab" : "is-summary"}`}
    >
      <header className="form-header">
        <button className="back-btn" onClick={handleBack} aria-label="Retour">
          <BackArrowIcon size={20} />
        </button>
        <h1 className="page-title">
          {activeTab ? TAB_CONFIG[activeTab].title : "Paramètres"}
        </h1>
        <div className="header-spacer" />
      </header>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <div className="sidebar-card nav-card">
            <nav className="settings-nav-list">
              {SETTINGS_TABS.map((tabKey) => {
                const { title, Icon } = TAB_CONFIG[tabKey];
                return (
                  <button
                    key={tabKey}
                    className={`nav-item-btn ${currentTab === tabKey && activeTab !== null ? "active" : ""}`}
                    onClick={() => handleSelectTab(tabKey)}
                  >
                    <span className="nav-icon">
                      <Icon size={20} />
                    </span>
                    <span className="nav-label">{title}</span>
                    <span className="nav-chevron">›</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="settings-main-content">
          {currentTab === "account" &&
            (isLoggedIn ? (
              <div className="settings-panel">
                <section className="settings-section-card">
                  <h2 className="section-title">Profil utilisateur</h2>
                  <div className="form-group">
                    <label htmlFor="username-input" className="input-label">
                      Nom d'utilisateur
                    </label>
                    <div className="input-group char-counter-field">
                      <input
                        id="username-input"
                        type="text"
                        className="settings-input"
                        maxLength={MAX_USERNAME_LENGTH}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                      <CharacterCounter
                        value={username}
                        maxLength={MAX_USERNAME_LENGTH}
                      />
                    </div>
                    <div className="input-footer">
                      <button
                        className="btn btn-primary"
                        disabled={
                          !username.trim() ||
                          username.trim() ===
                            localStorage.getItem("user_username") ||
                          usernameSaving
                        }
                        onClick={handleUsernameSave}
                      >
                        {usernameSaving ? "Enregistrement…" : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="settings-section-card">
                  <h2 className="section-title">Sécurité</h2>
                  <button className="btn btn-primary" onClick={handleLogout}>
                    Se déconnecter
                  </button>
                  <button
                    className="btn btn-revert stacked-btn"
                    disabled={resettingPassword}
                    onClick={handleResetPassword}
                  >
                    {resettingPassword
                      ? "Envoi en cours…"
                      : "Réinitialiser le mot de passe"}
                  </button>
                </section>

                <section className="settings-section-card danger-zone">
                  <h2 className="section-title danger-title">Zone de danger</h2>
                  <p className="section-description">
                    Cette action est irréversible. Toutes vos données seront
                    supprimées.
                  </p>
                  <div className="danger-actions">
                    <button
                      className="btn btn-danger"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      Supprimer le compte
                    </button>
                  </div>
                </section>

                {showDeleteModal && (
                  <div
                    className="modal-overlay"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    <div
                      className="modal-card"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="modal-title">Supprimer le compte ?</h3>
                      <p className="modal-text">
                        Voulez-vous vraiment supprimer votre compte et toutes
                        vos données ?
                      </p>
                      <p className="modal-text">
                        Cette action est irréversible.
                      </p>
                      <div className="modal-actions">
                        <button
                          className="btn btn-revert"
                          onClick={() => setShowDeleteModal(false)}
                          disabled={deleting}
                        >
                          Annuler
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={handleDeleteAccount}
                          disabled={deleting}
                        >
                          {deleting ? "Suppression…" : "Supprimer"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <LoginPrompt />
            ))}

          {currentTab === "data" &&
            (isLoggedIn ? (
              <div className="settings-panel">
                <section className="settings-section-card">
                  <h2 className="section-title">Importer / Exporter des plats</h2>
                  <p className="section-description">
                    Importez plusieurs plats d'un coup depuis un fichier JSON, ou
                    exportez tous vos plats dans un fichier JSON.
                  </p>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      void handleImportFile(file);
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => importInputRef.current?.click()}
                    disabled={importing}
                  >
                    {importing
                      ? "Importer depuis un fichier JSON…"
                      : "Importer depuis un fichier JSON"}
                  </button>
                  <button
                    className="btn btn-primary stacked-btn"
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    {exporting ? "Export en cours…" : "Exporter dans un fichier JSON"}
                  </button>
                </section>

                <section className="settings-section-card">
                  <h2 className="section-title">Restauration des données</h2>
                  <p className="section-description">
                    Sélectionnez une sauvegarde dans l'historique pour restaurer
                    l'état de vos plats.
                  </p>

                  {backupsLoading && (
                    <p className="section-description">Chargement…</p>
                  )}

                  {backupsError && (
                    <p
                      className="section-description"
                      style={{ color: "#ef4444" }}
                    >
                      {backupsError}
                    </p>
                  )}

                  {!backupsLoading && backups.length === 0 && (
                    <p className="section-description">
                      Aucune sauvegarde disponible.
                    </p>
                  )}

                  <div className="backup-timeline">
                    {backups.map((backup, index) => {
                      const isCurrent = index === 0;
                      const { dateLabel, timeLabel } = formatBackupDate(
                        backup.createdAt,
                      );
                      const isRestoring = restoringId === backup.id;

                      return (
                        <div
                          key={backup.id}
                          className={`timeline-item ${isCurrent ? "current" : ""}`}
                        >
                          <div className="timeline-marker">
                            <div className="timeline-dot" />
                            <div className="timeline-line" />
                          </div>

                          <div className="timeline-card">
                            <div className="backup-main-info">
                              <div className="backup-time-info">
                                <span className="backup-date">{dateLabel}</span>
                                <span className="backup-time">
                                  à {timeLabel}
                                </span>
                              </div>
                              <div className="backup-meta-chips">
                                <span className="meta-chip">
                                  🍽️ {backup.dishCount} plats
                                </span>
                              </div>
                            </div>

                            <div className="backup-action">
                              {isCurrent ? (
                                <span className="status-pill active-pill">
                                  ● Version active
                                </span>
                              ) : (
                                <button
                                  className="btn btn-primary btn-restore"
                                  disabled={isRestoring}
                                  onClick={() => handleRestore(backup.id)}
                                >
                                  {isRestoring ? "Restauration…" : "Restaurer"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            ) : (
              <LoginPrompt />
            ))}

          {currentTab === "bugs" &&
            (isLoggedIn ? (
              <div className="settings-panel">
                <section className="settings-section-card">
                  <h2 className="section-title">Signaler un bug</h2>
                  <p className="section-description">
                    Décrivez le problème rencontré pour nous aider à le résoudre
                    :
                  </p>
                  <ul className="bug-guidelines-list">
                    <li>Ce que vous faisiez juste avant l'incident</li>
                    <li>Si le comportement est systématique ou occasionnel</li>
                  </ul>

                  <div className="input-group char-counter-field">
                    <textarea
                      className="settings-textarea"
                      placeholder="Lorsque j'accepte plusieurs plats très rapidement..."
                      rows={5}
                      maxLength={MAX_FEEDBACK_LENGTH}
                      value={bugDescription}
                      onChange={(e) => setBugDescription(e.target.value)}
                    />
                    <CharacterCounter
                      value={bugDescription}
                      maxLength={MAX_FEEDBACK_LENGTH}
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      className="btn btn-primary"
                      disabled={!bugDescription.trim() || bugSubmitting}
                      onClick={handleBugSubmit}
                    >
                      {bugSubmitting ? "Envoi…" : "Envoyer le rapport"}
                    </button>
                  </div>
                </section>
              </div>
            ) : (
              <LoginPrompt />
            ))}

          {currentTab === "info" && (
            <div className="settings-panel">
              <section className="settings-section-card">
                <h2 className="section-title">
                  Informations sur l'application
                </h2>
                <div className="info-list">
                  <div className="info-row">
                    <span className="info-label">Version de l'application</span>
                    <span className="info-value">
                      {versionInfo?.latestVersion ?? "…"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Dernière synchronisation</span>
                    <span className="info-value">
                      {formatLastSync(lastSyncAt)}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default SettingsPage;