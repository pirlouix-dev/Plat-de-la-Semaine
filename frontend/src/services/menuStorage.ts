/**
 * Local storage for the saved weekly menu (the "saved dishes" recap).
 *
 * The menu is kept locally so it is available offline and instantly on load.
 * When the user is logged in it also participates in the sync engine
 * (`syncService`), which conditionally pushes local saves and resolves remote
 * versions.
 *
 * Only an explicit "Confirm" saves a snapshot (`savedIds`) to the server. Every
 * accept/refuse/undo only changes the local working state and marks it dirty,
 * so a later retry never pushes unsaved working changes.
 */

export type ViewMode = "editing" | "recap";

export type HistoryAction = { action: "accept" | "reject"; dishId: string };

export interface SavedMenuState {
  queueIds: string[];
  selectedIds: string[];
  history: HistoryAction[];
  mode: ViewMode;
}

export interface StoredMenu extends SavedMenuState {
  /** Snapshot of the menu sent by the last explicit save/clear. */
  savedIds: string[];
  /** A save/clear is waiting to be confirmed by the server. */
  pendingSave: boolean;
  /** Increments on every explicit save/clear, used to discard stale responses. */
  saveRevision: number;
  /** Increments on every local menu modification (any action). */
  localRevision: number;
  /** The last local revision that was reconciled with a server version. */
  reconciledRevision: number;
  /** Revision captured when the pending save was started. */
  pendingLocalRevision: number | null;
  /** Server timestamp of the last remote version observed. */
  serverUpdatedAt: string | null;
  /** Client timestamp of the last local modification. */
  lastModifiedAt: number;
  /** Client timestamp of the last explicit save/clear. */
  lastSavedAt: number;
}

/** Server shape of the saved menu. */
export interface RemoteMenu {
  selectedDishIds: string[];
  updatedAt: string | null;
}

export interface PendingRemoteMenu extends RemoteMenu {
  userId: string;
}

export type MenuEvent =
  | { type: "conflict"; userId: string; remote: RemoteMenu }
  | { type: "conflict-cleared"; userId: string }
  | { type: "remote-applied"; userId: string; menu: StoredMenu };

/** Guests keep the historical key so their existing selection is not lost. */
const GUEST_STORAGE_KEY = "pdls_choose_menu_state_v2";
const USER_STORAGE_KEY_PREFIX = "pdls_menu_state_v2:";

let pendingRemoteMenu: PendingRemoteMenu | null = null;
const listeners = new Set<(event: MenuEvent) => void>();

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

function parseTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseRevision(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

export function sameStringArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function emit(event: MenuEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeMenuEvents(
  listener: (event: MenuEvent) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function parseStoredMenu(raw: string): StoredMenu | null {
  let parsed: Partial<StoredMenu> & {
    updatedAt?: unknown;
    syncStatus?: unknown;
  };
  try {
    parsed = JSON.parse(raw) as Partial<StoredMenu> & {
      updatedAt?: unknown;
      syncStatus?: unknown;
    };
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.queueIds)) return null;

  const selectedIds = toStringArray(parsed.selectedIds);
  const history = parseHistory(parsed.history);
  const mode: ViewMode = parsed.mode === "recap" ? "recap" : "editing";

  const hasNewShape =
    typeof parsed.serverUpdatedAt !== "undefined" ||
    typeof parsed.localRevision !== "undefined";

  if (!hasNewShape) {
    // Migrate the pre-OCC document. A recap menu is considered saved; an
    // editing menu was only a draft and must not be pushed automatically.
    const legacyServerUpdatedAt =
      typeof parsed.updatedAt === "string" ? parsed.updatedAt : null;
    const wasSaved = mode === "recap" && selectedIds.length > 0;
    const pendingSave =
      wasSaved &&
      (parsed.syncStatus === "pending_update" ||
        legacyServerUpdatedAt === null);
    const localRevision =
      selectedIds.length > 0 || history.length > 0 ? 1 : 0;

    return {
      queueIds: toStringArray(parsed.queueIds),
      selectedIds,
      history,
      mode,
      savedIds: wasSaved ? selectedIds : [],
      pendingSave,
      saveRevision: 0,
      localRevision,
      reconciledRevision: pendingSave ? 0 : localRevision,
      pendingLocalRevision: pendingSave ? localRevision : null,
      serverUpdatedAt: legacyServerUpdatedAt,
      lastModifiedAt: 0,
      lastSavedAt: 0,
    };
  }

  const localRevision = parseRevision(parsed.localRevision);
  const reconciledRevision = Math.min(
    localRevision,
    parseRevision(parsed.reconciledRevision),
  );

  return {
    queueIds: toStringArray(parsed.queueIds),
    selectedIds,
    history,
    mode,
    savedIds: toStringArray(parsed.savedIds),
    pendingSave: parsed.pendingSave === true,
    saveRevision: parseRevision(parsed.saveRevision),
    localRevision,
    reconciledRevision,
    pendingLocalRevision:
      typeof parsed.pendingLocalRevision === "number"
        ? parsed.pendingLocalRevision
        : null,
    serverUpdatedAt:
      typeof parsed.serverUpdatedAt === "string"
        ? parsed.serverUpdatedAt
        : null,
    lastModifiedAt: parseTimestamp(parsed.lastModifiedAt),
    lastSavedAt: parseTimestamp(parsed.lastSavedAt),
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

function writeMenu(userId: string | null, menu: StoredMenu): StoredMenu {
  writeRaw(storageKey(userId), JSON.stringify(menu));
  return menu;
}

/**
 * Persist the local working state without changing sync metadata. Called on
 * every rendered session change, including initial load and queue builds.
 */
export function storeMenu(
  userId: string | null,
  state: SavedMenuState,
): StoredMenu {
  const stored = loadStoredMenu(userId);
  return writeMenu(userId, {
    ...state,
    savedIds: stored?.savedIds ?? [],
    pendingSave: stored?.pendingSave ?? false,
    saveRevision: stored?.saveRevision ?? 0,
    localRevision: stored?.localRevision ?? 0,
    reconciledRevision: stored?.reconciledRevision ?? 0,
    pendingLocalRevision: stored?.pendingLocalRevision ?? null,
    serverUpdatedAt: stored?.serverUpdatedAt ?? null,
    lastModifiedAt: stored?.lastModifiedAt ?? 0,
    lastSavedAt: stored?.lastSavedAt ?? 0,
  });
}

/**
 * Record a working-state modification (accept/refuse/undo). It makes the local
 * menu dirty for conflict detection but never schedules a server push.
 */
export function markMenuModified(userId: string | null): StoredMenu | null {
  const stored = loadStoredMenu(userId);
  if (!stored) return null;

  return writeMenu(userId, {
    ...stored,
    localRevision: stored.localRevision + 1,
    lastModifiedAt: Date.now(),
  });
}

/**
 * Snapshot the current menu and mark it as waiting to be pushed. This is the
 * only path that should schedule a PUT.
 */
export function beginMenuSave(
  userId: string | null,
  state: SavedMenuState,
  savedIds: string[],
): StoredMenu {
  const stored = loadStoredMenu(userId);
  const now = Date.now();
  const localRevision = (stored?.localRevision ?? 0) + 1;

  return writeMenu(userId, {
    ...state,
    savedIds: [...savedIds],
    pendingSave: true,
    saveRevision: (stored?.saveRevision ?? 0) + 1,
    localRevision,
    reconciledRevision: stored?.reconciledRevision ?? 0,
    pendingLocalRevision: localRevision,
    serverUpdatedAt: stored?.serverUpdatedAt ?? null,
    lastModifiedAt: now,
    lastSavedAt: now,
  });
}

export interface MenuPushSnapshot {
  saveRevision: number;
  localRevision: number;
}

/**
 * Record a successful PUT. Responses belonging to an older explicit save are
 * ignored for the pending flag; a newer save will be pushed separately.
 */
export function markMenuPushSucceeded(
  userId: string | null,
  snapshot: MenuPushSnapshot,
  remote: RemoteMenu,
): StoredMenu | null {
  const stored = loadStoredMenu(userId);
  if (!stored) return null;

  const next: StoredMenu = {
    ...stored,
    serverUpdatedAt: remote.updatedAt ?? stored.serverUpdatedAt,
  };

  if (stored.saveRevision === snapshot.saveRevision) {
    next.pendingSave = false;
    next.savedIds = [...remote.selectedDishIds];
    next.pendingLocalRevision = null;
    next.reconciledRevision = Math.max(
      next.reconciledRevision,
      snapshot.localRevision,
    );
  }

  writeMenu(userId, next);
  return next;
}

/**
 * The remote copy is identical to what we already have. Update the known
 * server version and clear a pending save when it matches the saved snapshot.
 */
export function markMenuMatchesRemote(
  userId: string | null,
  remote: RemoteMenu,
): StoredMenu | null {
  const stored = loadStoredMenu(userId);
  if (!stored) return null;

  const next: StoredMenu = {
    ...stored,
    serverUpdatedAt: remote.updatedAt ?? stored.serverUpdatedAt,
  };

  if (
    stored.pendingSave &&
    sameStringArray(remote.selectedDishIds, stored.savedIds)
  ) {
    next.pendingSave = false;
    next.savedIds = [...remote.selectedDishIds];
    next.pendingLocalRevision = null;
    next.reconciledRevision = Math.max(
      next.reconciledRevision,
      stored.pendingLocalRevision ?? stored.localRevision,
    );
  }

  if (sameStringArray(remote.selectedDishIds, stored.selectedIds)) {
    next.savedIds = [...remote.selectedDishIds];
    next.pendingSave = false;
    next.pendingLocalRevision = null;
    next.reconciledRevision = stored.localRevision;
  }

  writeMenu(userId, next);
  clearPendingRemoteMenu(userId, remote.updatedAt);
  return next;
}

export function isMenuDirty(menu: StoredMenu): boolean {
  return menu.localRevision !== menu.reconciledRevision;
}

/**
 * Apply a remote menu. The working review session is reset because it no longer
 * matches the incoming selection.
 */
export function applyRemoteMenu(
  userId: string | null,
  remote: RemoteMenu,
): StoredMenu | null {
  if (!userId) return null;

  const stored = loadStoredMenu(userId);
  const nextRevision = (stored?.localRevision ?? 0) + 1;
  const mode: ViewMode = remote.selectedDishIds.length > 0 ? "recap" : "editing";

  const next: StoredMenu = {
    queueIds: [],
    selectedIds: [...remote.selectedDishIds],
    history: [],
    mode,
    savedIds: [...remote.selectedDishIds],
    pendingSave: false,
    saveRevision: stored?.saveRevision ?? 0,
    localRevision: nextRevision,
    reconciledRevision: nextRevision,
    pendingLocalRevision: null,
    serverUpdatedAt: remote.updatedAt,
    lastModifiedAt: stored?.lastModifiedAt ?? 0,
    lastSavedAt: stored?.lastSavedAt ?? 0,
  };

  writeMenu(userId, next);
  clearPendingRemoteMenu(userId);
  emit({ type: "remote-applied", userId, menu: next });
  return next;
}

/**
 * Acknowledge a remote version without adopting it. Used when the user chooses
 * to keep the local menu. The next save uses the remote version as its OCC base.
 */
export function keepLocalMenu(
  userId: string | null,
  remote: RemoteMenu,
): StoredMenu | null {
  if (!userId) return null;
  const stored = loadStoredMenu(userId);
  if (!stored) {
    clearPendingRemoteMenu(userId);
    return null;
  }

  const next = writeMenu(userId, {
    ...stored,
    serverUpdatedAt: remote.updatedAt ?? stored.serverUpdatedAt,
  });
  clearPendingRemoteMenu(userId);
  return next;
}

export function getPendingRemoteMenu(userId: string | null): RemoteMenu | null {
  if (!userId || pendingRemoteMenu?.userId !== userId) return null;
  return {
    selectedDishIds: [...pendingRemoteMenu.selectedDishIds],
    updatedAt: pendingRemoteMenu.updatedAt,
  };
}

export function setPendingRemoteMenu(
  userId: string | null,
  remote: RemoteMenu,
): void {
  if (!userId) return;
  if (
    pendingRemoteMenu?.userId === userId &&
    pendingRemoteMenu.updatedAt === remote.updatedAt
  ) {
    return;
  }

  pendingRemoteMenu = {
    userId,
    selectedDishIds: [...remote.selectedDishIds],
    updatedAt: remote.updatedAt,
  };
  emit({ type: "conflict", userId, remote: getPendingRemoteMenu(userId)! });
}

export function clearPendingRemoteMenu(
  userId?: string | null,
  upToUpdatedAt?: string | null,
): void {
  if (!pendingRemoteMenu) return;
  if (userId && pendingRemoteMenu.userId !== userId) return;

  // A stale response must not clear a banner for a newer remote version.
  if (
    upToUpdatedAt &&
    pendingRemoteMenu.updatedAt &&
    Date.parse(pendingRemoteMenu.updatedAt) > Date.parse(upToUpdatedAt)
  ) {
    return;
  }

  const clearedUserId = pendingRemoteMenu.userId;
  pendingRemoteMenu = null;
  emit({ type: "conflict-cleared", userId: clearedUserId });
}

/** @internal Reset module-level state. Only for use in tests. */
export function _resetMenuStorageState(): void {
  pendingRemoteMenu = null;
  listeners.clear();
}
