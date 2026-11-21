import { DEFAULT_LOCALE, LOCALES, type Locale } from "./types";

/** Device-level choice: it must work before the database exists (guest, login). */
export const LANGUAGE_STORAGE_KEY = "ui_language";

const listeners = new Set<() => void>();
let current: Locale | null = null;

function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

function readStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/** First supported tag in the browser's preference list, or English. */
export function detectBrowserLocale(): Locale {
  const languages =
    typeof navigator === "undefined"
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language];

  for (const tag of languages) {
    if (!tag) continue;
    const base = tag.toLowerCase().split("-")[0];
    if (isSupportedLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}

function applyDocumentLang(locale: Locale): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export function getLocale(): Locale {
  if (current === null) {
    current = readStoredLocale() ?? detectBrowserLocale();
    applyDocumentLang(current);
  }
  return current;
}

/** Explicit choice: persist it, update the document, and rerender subscribers. */
export function setLocale(next: Locale): void {
  if (!isSupportedLocale(next)) return;
  const previous = getLocale();
  current = next;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    // localStorage unavailable (e.g. private mode); the choice lives for this session
  }
  applyDocumentLang(next);
  if (previous !== next) {
    listeners.forEach((listener) => listener());
  }
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * @internal Pin the locale and clear the stored choice. Only for tests.
 * Passing `null` forgets the in-memory locale without touching storage, so the
 * next `getLocale()` resolves it again from storage or the browser.
 */
export function __resetI18nForTests(locale: Locale | null = DEFAULT_LOCALE): void {
  if (locale === null) {
    current = null;
    listeners.forEach((listener) => listener());
    return;
  }

  current = locale;
  try {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
  applyDocumentLang(locale);
  listeners.forEach((listener) => listener());
}
