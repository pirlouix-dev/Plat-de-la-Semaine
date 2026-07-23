/**
 * Settings page section definitions for "Plat de la Semaine"
 */

export const SETTINGS_SECTIONS = [
  { id: "info", label: "Informations pratiques" },
  { id: "backups", label: "Restauration des données" },
  { id: "bug", label: "Signaler un bug" },
  { id: "resort", label: "Retrier les plats" },
  { id: "updates", label: "Mises à jour" },
] as const;

export type SectionId = (typeof SETTINGS_SECTIONS)[number]["id"];
