import { useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  BackArrowIcon,
  BugIcon,
  InfoIcon,
  RefreshIcon,
  UserIcon,
} from "../../components/Icons";
import "./SettingsPage.css";

type SettingsTab = "account" | "data" | "bugs" | "info";

// Doit rester en phase avec le breakpoint CSS de SettingsPage.css
const MOBILE_LAYOUT_QUERY = "(max-width: 649px)";

interface Backup {
  id: string;
  dateLabel: string;
  timeLabel: string;
  dishesCount: number;
  descriptionsCount: number;
  isCurrent?: boolean;
}

const TAB_CONFIG: Record<
  SettingsTab,
  { title: string; Icon: ComponentType<{ size?: number }> }
> = {
  account: { title: "Mon compte", Icon: UserIcon },
  data: { title: "Données & Plats", Icon: RefreshIcon },
  bugs: { title: "Signaler un bug", Icon: BugIcon },
  info: { title: "À propos", Icon: InfoIcon },
};

const MOCK_BACKUPS: Backup[] = [
  {
    id: "b1",
    dateLabel: "Aujourd'hui",
    timeLabel: "09:21",
    dishesCount: 16,
    descriptionsCount: 15,
    isCurrent: true,
  },
  {
    id: "b2",
    dateLabel: "19/08/2026",
    timeLabel: "09:18",
    dishesCount: 15,
    descriptionsCount: 15,
  },
  {
    id: "b3",
    dateLabel: "21/06/2026",
    timeLabel: "17:45",
    dishesCount: 16,
    descriptionsCount: 15,
  },
  {
    id: "b4",
    dateLabel: "21/06/2026",
    timeLabel: "12:30",
    dishesCount: 14,
    descriptionsCount: 13,
  },
];

export function SettingsPage() {
  const navigate = useNavigate();
  // Sur mobile, null représente le sommaire ; sur desktop, le premier onglet est ouvert
  const [activeTab, setActiveTab] = useState<SettingsTab | null>(() =>
    window.matchMedia(MOBILE_LAYOUT_QUERY).matches ? null : "account",
  );

  // Formulaires
  const [username, setUsername] = useState("toto");
  const [bugDescription, setBugDescription] = useState("");
  const [backups, setBackups] = useState<Backup[]>(MOCK_BACKUPS);

  const handleRestore = (id: string) => {
    setBackups((prev) =>
      prev.map((b) => ({
        ...b,
        isCurrent: b.id === id,
      })),
    );
  };

  const handleBack = () => {
    // Sur mobile uniquement, le bouton retour ramène d'abord au sommaire
    if (activeTab !== null && window.matchMedia(MOBILE_LAYOUT_QUERY).matches) {
      setActiveTab(null);
    } else {
      navigate("/");
    }
  };

  // Repli si on arrive au sommaire mobile puis qu'on passe en desktop
  const currentTab = activeTab ?? "account";

  return (
    <div
      className={`settings-container ${activeTab ? "has-active-tab" : "is-summary"}`}
    >
      {/* En-tête de page dynamique */}
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
        {/* Sommaire / Menu latéral */}
        <aside className="settings-sidebar">
          <div className="sidebar-card nav-card">
            <nav className="settings-nav-list">
              {(Object.keys(TAB_CONFIG) as SettingsTab[]).map((tabKey) => {
                const { title, Icon } = TAB_CONFIG[tabKey];
                return (
                  <button
                    key={tabKey}
                    className={`nav-item-btn ${currentTab === tabKey && activeTab !== null ? "active" : ""}`}
                    onClick={() => setActiveTab(tabKey)}
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

        {/* Panneau de contenu principal */}
        <main className="settings-main-content">
          {/* ONGLET 1 : MON COMPTE */}
          {currentTab === "account" && (
            <div className="settings-panel">
              <section className="settings-section-card">
                <h2 className="section-title">Profil utilisateur</h2>
                <div className="form-group">
                  <label htmlFor="username-input" className="input-label">
                    Nom d'utilisateur
                  </label>
                  <input
                    id="username-input"
                    type="text"
                    className="settings-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <button className="btn btn-primary">Enregistrer</button>
                </div>
              </section>

              <section className="settings-section-card">
                <h2 className="section-title">Sécurité</h2>
                <button className="btn btn-primary">Se déconnecter</button>
                <button className="btn btn-revert security-btn">
                  Réinitialiser le mot de passe
                </button>
              </section>

              <section className="settings-section-card danger-zone">
                <h2 className="section-title danger-title">Zone de danger</h2>
                <div className="danger-actions">
                  <button className="btn btn-danger">
                    Supprimer le compte
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* ONGLET 2 : DONNÉES & RESTAURATION (TIMELINE) */}
          {currentTab === "data" && (
            <div className="settings-panel">
              <section className="settings-section-card">
                <h2 className="section-title">Restauration des données</h2>
                <p className="section-description">
                  Sélectionnez une sauvegarde dans l'historique pour restaurer
                  l'état de vos plats.
                </p>

                <div className="backup-timeline">
                  {backups.map((backup) => (
                    <div
                      key={backup.id}
                      className={`timeline-item ${backup.isCurrent ? "current" : ""}`}
                    >
                      <div className="timeline-marker">
                        <div className="timeline-dot" />
                        <div className="timeline-line" />
                      </div>

                      <div className="timeline-card">
                        <div className="timeline-card-header">
                          <div className="backup-time-info">
                            <span className="backup-date">
                              {backup.dateLabel}
                            </span>
                            <span className="backup-time">
                              {" "}
                              à {backup.timeLabel}
                            </span>
                          </div>

                          {backup.isCurrent ? (
                            <span className="status-pill active-pill">
                              ● Version active
                            </span>
                          ) : (
                            <button
                              className="btn btn-primary"
                              onClick={() => handleRestore(backup.id)}
                            >
                              Restaurer
                            </button>
                          )}
                        </div>

                        <div className="backup-meta-chips">
                          <span className="meta-chip">
                            🍽️ {backup.dishesCount} plats
                          </span>
                          <span className="meta-chip">
                            📝 {backup.descriptionsCount} descriptions
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ONGLET 3 : SIGNALER UN BUG */}
          {currentTab === "bugs" && (
            <div className="settings-panel">
              <section className="settings-section-card">
                <h2 className="section-title">Signaler un bug</h2>
                <p className="section-description">
                  Décrivez le problème rencontré pour nous aider à le résoudre :
                </p>
                <ul className="bug-guidelines-list">
                  <li>Ce que vous faisiez juste avant l'incident</li>
                  <li>Si le comportement est systématique ou occasionnel</li>
                </ul>

                <textarea
                  className="settings-textarea"
                  placeholder="Lorsque j'accepte plusieurs plats très rapidement..."
                  rows={5}
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                />

                <div className="form-actions">
                  <button
                    className="btn btn-primary"
                    disabled={!bugDescription.trim()}
                  >
                    Envoyer le rapport
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* ONGLET 4 : À PROPOS */}
          {currentTab === "info" && (
            <div className="settings-panel">
              <section className="settings-section-card">
                <h2 className="section-title">
                  Informations sur l'application
                </h2>
                <div className="info-list">
                  <div className="info-row">
                    <span className="info-label">Version de l'application</span>
                    <span className="info-value">4.0.0</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Dernière synchronisation</span>
                    <span className="info-value">19/08/2026 à 09:00</span>
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
