import { sha256 } from "js-sha256";

/** Database used by releases before local data was scoped per account. */
export const LEGACY_DATABASE_NAME = "pdlsv4";

/**
 * Guest database used once the legacy database has been claimed by an account.
 * Until then the guest keeps using the legacy database so existing guest data
 * is not lost.
 */
export const GUEST_DATABASE_NAME = "pdlsv4guest";

const USER_DATABASE_PREFIX = "pdlsv4u";

/** Persisted account that owns the legacy shared database ("" = guest). */
const LEGACY_OWNER_STORAGE_KEY = "pdlsv4_legacy_owner";

/** Set once the legacy database has been copied into the owner's database. */
const LEGACY_MIGRATED_STORAGE_KEY = "pdlsv4_legacy_migrated";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // localStorage unavailable (e.g. in tests or SSR)
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (e.g. in tests or SSR)
  }
}

/**
 * Read the account that owns the legacy shared database, assigning it on first
 * use. An empty string means the legacy database belongs to the guest session.
 *
 * The assignment is permanent: a later account can never inherit data that was
 * written under a previous one.
 */
export function claimLegacyDatabaseOwner(userId: string | null): string {
  const existing = readStorage(LEGACY_OWNER_STORAGE_KEY);
  if (existing !== null) return existing;

  const owner = userId ?? "";
  writeStorage(LEGACY_OWNER_STORAGE_KEY, owner);
  return owner;
}

export function isLegacyDatabaseMigrationDone(): boolean {
  return readStorage(LEGACY_MIGRATED_STORAGE_KEY) === "1";
}

export function markLegacyDatabaseMigrationDone(): void {
  writeStorage(LEGACY_MIGRATED_STORAGE_KEY, "1");
}

/** Per-account database name. The hash keeps the name within RxDB's regex. */
export function userDatabaseName(userId: string): string {
  return USER_DATABASE_PREFIX + sha256.hex(userId).slice(0, 24);
}

function guestDatabaseName(legacyOwner: string): string {
  return legacyOwner === "" ? LEGACY_DATABASE_NAME : GUEST_DATABASE_NAME;
}

/**
 * Each account gets its own IndexedDB database so its local state (including
 * pending changes) survives switching users and can never leak into another
 * account's database.
 */
export function databaseNameForUser(
  userId: string | null,
  legacyOwner: string,
): string {
  return userId ? userDatabaseName(userId) : guestDatabaseName(legacyOwner);
}

/** @internal Reset the persisted legacy assignment. Only for tests. */
export function _resetDatabaseNaming(): void {
  try {
    localStorage.removeItem(LEGACY_OWNER_STORAGE_KEY);
    localStorage.removeItem(LEGACY_MIGRATED_STORAGE_KEY);
  } catch {
    // localStorage unavailable (e.g. in tests or SSR)
  }
}
