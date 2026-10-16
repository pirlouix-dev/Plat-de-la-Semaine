/**
 * Local storage for the saved weekly menu (the "Plats sauvegardés" recap).
 *
 * The menu is kept locally so it is available offline and instantly on load.
 * When the user is logged in it also participates in the sync engine
 * (`syncService`), which pushes local changes and pulls the server copy.
 *
 * Only the syncable part (`selectedIds`, `mode`) is sent to the server. The
 * review `queueIds` and `history` stay device-local.
 */

export type ViewMode = "editing" | "recap";

export type HistoryAction = { action: "accept" | "reject"; dishId: string };

export type MenuSyncStatus = "synced" | "pending_update";

export interface SavedMenuState {
  queueIds: string[];
  selectedIds: string[];
  history: HistoryAction[];
  mode: ViewMode;
}

export interface StoredMenu extends SavedMenuState {
  /** Server timestamp of the last synced version, null when never synced. */
  updatedAt: string | null;
  syncStatus: MenuSyncStatus;
}

/** Server shape of the syncable part of the menu. */
export interface RemoteMenu {
  selectedDishIds: string[];
  mode: ViewMode;
  updatedAt: string | null;
}

/** Guests keep the historical key so their existing selection is not lost. */
const GUEST_STORAGE_KEY = "pdls_choose_menu_state_v2";
const USER_STORAGE_KEY_PREFIX = "pdls_menu_state_v2:";

function storageKey(userId: string | null): string {
  return userId ? `${USER_STORAGE_KEY_PREFIX}${userId}` : GUEST_STORAGE_KEY;
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (e.g. in tests or SSR)
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function parseHistory(value: unknown): HistoryAction[] {
  return Array.isArray(value)
    ? value.filter(
        (h): h is HistoryAction =>
          !!h &&
          typeof h === "object" &&
          ((h as HistoryAction).action === "accept" ||
            (h as HistoryAction).action === "reject") &&
          typeof (h as HistoryAction).dishId === "string",
      )
    : [];
}

function sameStringArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function parseStoredMenu(raw: string): StoredMenu | null {
  let parsed: Partial<StoredMenu>;
  try {
    parsed = JSON.parse(raw) as Partial<StoredMenu>;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.queueIds)) return null;
  return {
    queueIds: toStringArray(parsed.queueIds),
    selectedIds: toStringArray(parsed.selectedIds),
    history: parseHistory(parsed.history),
    mode: parsed.mode === "recap" ? "recap" : "editing",
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    syncStatus: parsed.syncStatus === "pending_update" ? "pending_update" : "synced",
  };
}

/**
 * Read the locally stored menu for a user (or the guest slot when `userId` is
 * null). A previously guest-stored selection is adopted by a logged-in user the
 * first time they open the page.
 */
export function loadStoredMenu(userId: string | null): StoredMenu | null {
  const raw = readRaw(storageKey(userId));
  if (raw) return parseStoredMenu(raw);

  if (userId) {
    const legacy = readRaw(GUEST_STORAGE_KEY);
    if (legacy) return parseStoredMenu(legacy);
  }

  return null;
}

/**
 * Persist the menu. The document is marked `pending_update` only when the
 * syncable part (`selectedIds` / `mode`) changed, so review-only changes
 * (queue/history) do not trigger a server push.
 */
export function storeMenu(userId: string | null, state: SavedMenuState): void {
  const stored = loadStoredMenu(userId);
  const syncableChanged = stored
    ? !sameStringArray(stored.selectedIds, state.selectedIds) ||
      stored.mode !== state.mode
    : state.selectedIds.length > 0;

  const next: StoredMenu = {
    ...state,
    updatedAt: stored?.updatedAt ?? null,
    syncStatus: syncableChanged
      ? "pending_update"
      : (stored?.syncStatus ?? "synced"),
  };

  writeRaw(storageKey(userId), JSON.stringify(next));
}

/** Record that the current local menu was successfully pushed to the server. */
export function markMenuSynced(
  userId: string | null,
  updatedAt: string | null,
): void {
  const stored = loadStoredMenu(userId);
  if (!stored) return;
  writeRaw(
    storageKey(userId),
    JSON.stringify({ ...stored, updatedAt, syncStatus: "synced" }),
  );
}

/**
 * Apply a server copy of the menu. Local unsynced changes win; otherwise the
 * remote copy is adopted when it is newer. Adopting resets the local review
 * session, which no longer matches the incoming selection.
 */
export function applyRemoteMenu(userId: string | null, remote: RemoteMenu): void {
  if (!userId) return;
  const stored = loadStoredMenu(userId);
  if (stored?.syncStatus === "pending_update") return;

  const remoteUpdated = remote.updatedAt ? Date.parse(remote.updatedAt) : null;
  if (remoteUpdated === null) return;

  const localUpdated = stored?.updatedAt ? Date.parse(stored.updatedAt) : null;
  if (localUpdated !== null && localUpdated >= remoteUpdated) return;

  const next: StoredMenu = {
    queueIds: [],
    selectedIds: remote.selectedDishIds,
    history: [],
    mode: remote.mode,
    updatedAt: remote.updatedAt,
    syncStatus: "synced",
  };

  writeRaw(storageKey(userId), JSON.stringify(next));
}
