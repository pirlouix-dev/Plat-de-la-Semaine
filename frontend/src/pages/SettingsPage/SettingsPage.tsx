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
  GlobeIcon,
  InfoIcon,
  RefreshIcon,
  UserIcon,
} from "../../components/Icons";
import CharacterCounter from "../../components/CharacterCounter";
import { useDatabase } from "../../db/DatabaseContext";
import { removeLocalDatabaseForUser } from "../../db/databaseManagerInstance";
import { useToast } from "../../components/toastContext";
import { getBackups, restoreBackup } from "../../services/backupService";
import { getVersionInfo, submitFeedback } from "../../services/settingsService";
import {
  flushPendingDishes,
  getLastSyncAt,
  refreshFromServer,
} from "../../services/syncService";
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
import {
  clearAuth,
  getApiErrorMessage,
  getCurrentUserId,
} from "../../services/api";
import { useApiErrorToast } from "../../hooks/useApiErrorToast";
import { useIsLoggedIn } from "../../hooks/useIsLoggedIn";
import { useSyncState } from "../../hooks/useSyncStatus";
import { MAX_FEEDBACK_LENGTH, MAX_USERNAME_LENGTH } from "../../types/dish";
import {
  LOCALE_OPTIONS,
  useTranslation,
  type Locale,
  type MessageKey,
} from "../../i18n";
import type { ApiErrorDetail, BackupSummary } from "../../types";
import type { VersionInfo } from "../../services/settingsService";
import "./SettingsPage.css";

type SettingsTab = "language" | "account" | "data" | "bugs" | "info";

// Must match the CSS media query in SettingsPage.css
const MOBILE_LAYOUT_QUERY = "(max-width: 649px)";

const TAB_CONFIG: Record<
  SettingsTab,
  { titleKey: MessageKey; Icon: ComponentType<{ size?: number }> }
> = {
  language: { titleKey: "settings.tab.language", Icon: GlobeIcon },
  account: { titleKey: "settings.tab.account", Icon: UserIcon },
  data: { titleKey: "settings.tab.data", Icon: RefreshIcon },
  bugs: { titleKey: "settings.tab.bugs", Icon: BugIcon },
  info: { titleKey: "settings.tab.info", Icon: InfoIcon },
};

const SETTINGS_TABS = Object.keys(TAB_CONFIG) as SettingsTab[];

function parseTabHash(hash: string): SettingsTab | null {
  const value = hash.replace(/^#/, "");
  return (SETTINGS_TABS as string[]).includes(value)
    ? (value as SettingsTab)
    : null;
}

function LoginPrompt() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="settings-panel">
      <section className="settings-section-card">
        <p className="section-description-login">
          {t("settings.loginPrompt")}
        </p>
        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={() => navigate("/login")}
          >
            {t("settings.signIn")}
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
  const showApiErrorToast = useApiErrorToast();
  const isLoggedIn = useIsLoggedIn();
  const { t, locale, setLocale, formatDate, formatTime } = useTranslation();

  const isMobileLayout = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
  const activeTab: SettingsTab | null =
    parseTabHash(location.hash) ?? (isMobileLayout ? null : "account");

  const formatBackupDate = (
    isoDate: string,
  ): { dateLabel: string; timeLabel: string } => {
    const d = new Date(isoDate);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    const timeLabel = formatTime(d);

    if (isToday) {
      return { dateLabel: t("common.today"), timeLabel };
    }

    return { dateLabel: formatDate(d), timeLabel };
  };

  const formatLastSync = (isoDate: string | null): string => {
    if (!isoDate) return t("common.never");
    const d = new Date(isoDate);
    return t("common.at", {
      date: formatDate(d),
      time: formatTime(d),
    });
  };

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
      showToast(t("settings.account.usernameUpdated"), "success");
    } else {
      showApiErrorToast(result.error);
    }
    setUsernameSaving(false);
  };

  const handleResetPassword = async () => {
    setResettingPassword(true);
    const result = await resetPassword();
    if (result.ok) {
      showToast(t("settings.account.resetEmailSent"), "warning");
    } else {
      showApiErrorToast(result.error);
    }
    setResettingPassword(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const result = await deleteAccount();
    if (result.ok) {
      const deletedUserId = getCurrentUserId();
      // Switch to the guest database first, then erase the deleted account's
      // local copy without tearing down the database the UI is still using.
      clearAuth();
      navigate("/", { replace: true });

      if (deletedUserId) {
        try {
          await removeLocalDatabaseForUser(deletedUserId);
        } catch (err) {
          // The account is already gone server-side; a local cleanup failure
          // must not block the logout.
          console.error("Failed to remove local account data:", err);
        }
      }
    } else {
      showApiErrorToast(result.error);
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
        showToast(t("settings.data.importReadError"), "error");
        return;
      }

      const parsed = parseDishImportJson(text);
      if (!parsed.ok) {
        showToast(t(parsed.error), "error");
        return;
      }

      if (parsed.items.length === 0) {
        showToast(t("settings.data.importEmpty"), "error");
        return;
      }

      try {
        if (!db) throw new Error("Database not ready");

        // Imports are local-first: the dishes show up immediately and travel to
        // the server through the same pending-changes push as any other edit.
        await insertManyDishes(db, buildPendingDishes(parsed.items));
        const flush = await flushPendingDishes(db);

        const saved = parsed.items.length;
        const rejected = parsed.errors.length;
        const parts =
          flush === null
            ? [t("settings.data.importSaved", { count: saved })]
            : [t("settings.data.importImported", { count: saved })];
        if (rejected > 0) {
          parts.push(t("settings.data.importFailed", { count: rejected }));
        }
        if (flush?.failed) {
          parts.push(t("settings.data.importSyncIncomplete"));
        }

        // A failed flush is not an import failure: the dishes are stored and
        // the next sync retries them, so it only warns.
        const type =
          rejected > 0 ? "error" : flush?.failed ? "warning" : "success";
        showToast(parts.join(", "), type);
      } catch {
        showToast(t("settings.data.importError"), "error");
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
        showToast(t("settings.data.exportEmpty"), "error");
        return;
      }

      downloadJsonFile(buildExportFilename(), serializeDishExport(dishes));
      showToast(
        t("settings.data.exported", { count: exportable.length }),
        "success",
      );
    } catch {
      showToast(t("settings.data.exportError"), "error");
    } finally {
      setExporting(false);
    }
  };

  const currentTab = activeTab ?? "account";

  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsError, setBackupsError] = useState<ApiErrorDetail | null>(
    null,
  );
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setBackupsLoading(true);
    setBackupsError(null);
    const result = await getBackups();
    if (result.ok) {
      setBackups(result.data);
    } else {
      setBackupsError(result.error);
    }
    setBackupsLoading(false);
  }, []);

  const handleRestore = async (backupId: string) => {
    setRestoringId(backupId);
    const result = await restoreBackup(backupId);
    if (result.ok) {
      showToast(t("settings.data.restoreSuccess"), "success");
      await fetchBackups();
    } else {
      showApiErrorToast(result.error);
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
      showToast(t("settings.bugs.success"), "success");
      setBugDescription("");
    } else {
      showApiErrorToast(result.error);
    }
    setBugSubmitting(false);
  };

  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const syncState = useSyncState();
  const syncBusy = refreshing || syncState.phase === "syncing";

  const handleRefreshFromServer = async () => {
    if (!db) {
      showToast(t("settings.data.databaseUnavailable"), "error");
      return;
    }

    setRefreshing(true);
    try {
      const ok = await refreshFromServer(db);
      if (ok) {
        setLastSyncAt(await getLastSyncAt(db));
        showToast(t("settings.data.refreshSuccess"), "success");
      } else {
        showToast(
          navigator.onLine
            ? t("settings.data.refreshFailed")
            : t("settings.data.refreshOffline"),
          "error",
        );
      }
    } catch {
      showToast(t("settings.data.refreshFailed"), "error");
    } finally {
      setRefreshing(false);
    }
  };

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
        setBackupsError(result.error);
      }
      setBackupsLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentTab, backups.length, isLoggedIn]);

  useEffect(() => {
    if (currentTab !== "info" && currentTab !== "data") return;
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
        <button
          className="back-btn"
          onClick={handleBack}
          aria-label={t("common.back")}
        >
          <BackArrowIcon size={20} />
        </button>
        <h1 className="page-title">
          {activeTab ? t(TAB_CONFIG[activeTab].titleKey) : t("settings.title")}
        </h1>
        <div className="header-spacer" />
      </header>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <div className="sidebar-card nav-card">
            <nav className="settings-nav-list">
              {SETTINGS_TABS.map((tabKey) => {
                const { titleKey, Icon } = TAB_CONFIG[tabKey];
                const title = t(titleKey);
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
          {currentTab === "language" && (
            <div className="settings-panel">
              <section className="settings-section-card">
                <h2 className="section-title">
                  {t("settings.language.title")}
                </h2>
                <p className="section-description">
                  {t("settings.language.description")}
                </p>
                <div className="form-group">
                  <label htmlFor="language-select" className="input-label">
                    {t("settings.language.label")}
                  </label>
                  <select
                    id="language-select"
                    className="settings-input"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as Locale)}
                  >
                    {LOCALE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
            </div>
          )}

          {currentTab === "account" &&
            (isLoggedIn ? (
              <div className="settings-panel">
                <section className="settings-section-card">
                  <h2 className="section-title">
                    {t("settings.account.profile")}
                  </h2>
                  <div className="form-group">
                    <label htmlFor="username-input" className="input-label">
                      {t("settings.account.username")}
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
                        {usernameSaving
                          ? t("common.saving")
                          : t("common.save")}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="settings-section-card">
                  <h2 className="section-title">
                    {t("settings.account.security")}
                  </h2>
                  <button className="btn btn-primary" onClick={handleLogout}>
                    {t("settings.account.signOut")}
                  </button>
                  <button
                    className="btn btn-revert stacked-btn"
                    disabled={resettingPassword}
                    onClick={handleResetPassword}
                  >
                    {resettingPassword
                      ? t("settings.account.resetPasswordSending")
                      : t("settings.account.resetPassword")}
                  </button>
                </section>

                <section className="settings-section-card danger-zone">
                  <h2 className="section-title danger-title">
                    {t("settings.account.dangerZone")}
                  </h2>
                  <p className="section-description">
                    {t("settings.account.deleteWarning")}
                  </p>
                  <div className="danger-actions">
                    <button
                      className="btn btn-danger"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      {t("settings.account.deleteAccount")}
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
                      <h3 className="modal-title">
                        {t("settings.account.deleteTitle")}
                      </h3>
                      <p className="modal-text">
                        {t("settings.account.deleteConfirm")}
                      </p>
                      <p className="modal-text">
                        {t("settings.account.deleteIrreversible")}
                      </p>
                      <div className="modal-actions">
                        <button
                          className="btn btn-revert"
                          onClick={() => setShowDeleteModal(false)}
                          disabled={deleting}
                        >
                          {t("common.cancel")}
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={handleDeleteAccount}
                          disabled={deleting}
                        >
                          {deleting
                            ? t("common.deleting")
                            : t("common.delete")}
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
                  <h2 className="section-title">
                    {t("settings.data.syncTitle")}
                  </h2>
                  <p className="section-description">
                    {t("settings.data.syncDescription")}
                  </p>
                  <p className="section-description">
                    {t("settings.data.lastSync", {
                      value: formatLastSync(lastSyncAt),
                    })}
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={handleRefreshFromServer}
                    disabled={syncBusy}
                    title={
                      !refreshing && syncState.phase === "syncing"
                        ? t("settings.data.syncing")
                        : undefined
                    }
                  >
                    {refreshing
                      ? t("settings.data.refreshing")
                      : t("settings.data.refresh")}
                  </button>
                </section>

                <section className="settings-section-card">
                  <h2 className="section-title">
                    {t("settings.data.importExport")}
                  </h2>
                  <p className="section-description">
                    {t("settings.data.importExportDescription")}
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
                      ? t("settings.data.importing")
                      : t("settings.data.import")}
                  </button>
                  <button
                    className="btn btn-primary stacked-btn"
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    {exporting
                      ? t("settings.data.exporting")
                      : t("settings.data.export")}
                  </button>
                </section>

                <section className="settings-section-card">
                  <h2 className="section-title">
                    {t("settings.data.backupTitle")}
                  </h2>
                  <p className="section-description">
                    {t("settings.data.backupDescription")}
                  </p>

                  {backupsLoading && (
                    <p className="section-description">
                      {t("settings.data.backupsLoading")}
                    </p>
                  )}

                  {backupsError && (
                    <p
                      className="section-description"
                      style={{ color: "#ef4444" }}
                    >
                      {getApiErrorMessage(backupsError)}
                    </p>
                  )}

                  {!backupsLoading && backups.length === 0 && (
                    <p className="section-description">
                      {t("settings.data.backupsEmpty")}
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
                                  {t("settings.data.atTime", {
                                    time: timeLabel,
                                  })}
                                </span>
                              </div>
                              <div className="backup-meta-chips">
                                <span className="meta-chip">
                                  🍽️{" "}
                                  {t("settings.data.backupDishes", {
                                    count: backup.dishCount,
                                  })}
                                </span>
                              </div>
                            </div>

                            <div className="backup-action">
                              {isCurrent ? (
                                <span className="status-pill active-pill">
                                  {t("settings.data.activeVersion")}
                                </span>
                              ) : (
                                <button
                                  className="btn btn-primary btn-restore"
                                  disabled={isRestoring}
                                  onClick={() => handleRestore(backup.id)}
                                >
                                  {isRestoring
                                    ? t("settings.data.restoring")
                                    : t("settings.data.restore")}
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
                  <h2 className="section-title">
                    {t("settings.bugs.title")}
                  </h2>
                  <p className="section-description">
                    {t("settings.bugs.description")}
                  </p>
                  <ul className="bug-guidelines-list">
                    <li>{t("settings.bugs.guidelineBefore")}</li>
                    <li>{t("settings.bugs.guidelineFrequency")}</li>
                  </ul>

                  <div className="input-group char-counter-field">
                    <textarea
                      className="settings-textarea"
                      placeholder={t("settings.bugs.placeholder")}
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
                      {bugSubmitting
                        ? t("settings.bugs.sending")
                        : t("settings.bugs.submit")}
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
                <h2 className="section-title">{t("settings.info.title")}</h2>
                <div className="info-list">
                  <div className="info-row">
                    <span className="info-label">
                      {t("settings.info.version")}
                    </span>
                    <span className="info-value">
                      {versionInfo?.latestVersion ?? "…"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">
                      {t("settings.info.lastSync")}
                    </span>
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
