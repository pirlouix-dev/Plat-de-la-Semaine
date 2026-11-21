import { describe, it, expect, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  LANGUAGE_STORAGE_KEY,
  LOCALES,
  __resetI18nForTests,
  createTranslator,
  detectBrowserLocale,
  getLocale,
  setLocale,
  translate,
  useTranslation,
  type Locale,
  type MessageKey,
  type MessageValue,
  type PluralForms,
} from "../i18n";
import { en } from "../i18n/locales/en";
import { fr } from "../i18n/locales/fr";

const t = createTranslator("en");
const f = createTranslator("fr");

const originalLanguages = navigator.languages;
const originalLanguage = navigator.language;

function setNavigatorLanguages(
  languages: string[],
  language = languages[0] ?? "en-US",
): void {
  Object.defineProperty(window.navigator, "languages", {
    value: languages,
    configurable: true,
  });
  Object.defineProperty(window.navigator, "language", {
    value: language,
    configurable: true,
  });
}

function isPlural(value: MessageValue): value is PluralForms {
  return typeof value !== "string";
}

function templates(value: MessageValue): string[] {
  return isPlural(value) ? Object.values(value) : [value];
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

afterEach(() => {
  Object.defineProperty(window.navigator, "languages", {
    value: originalLanguages,
    configurable: true,
  });
  Object.defineProperty(window.navigator, "language", {
    value: originalLanguage,
    configurable: true,
  });
  vi.restoreAllMocks();
});

describe("catalogues", () => {
  const keys = Object.keys(en).sort() as MessageKey[];

  it("declare the same keys in every locale", () => {
    expect(Object.keys(fr).sort()).toEqual(keys);
  });

  it("never contain an empty message", () => {
    for (const key of keys) {
      for (const template of templates(en[key])) {
        expect(template.trim(), `en:${key}`).not.toBe("");
      }
      for (const template of templates(fr[key])) {
        expect(template.trim(), `fr:${key}`).not.toBe("");
      }
    }
  });

  it("provide one and other forms for every plural message", () => {
    for (const key of keys) {
      if (!isPlural(en[key])) continue;
      expect(en[key].one, `en:${key}`).toBeTruthy();
      expect(en[key].other, `en:${key}`).toBeTruthy();
    }
    for (const key of keys) {
      if (!isPlural(fr[key])) continue;
      expect(fr[key].one, `fr:${key}`).toBeTruthy();
      expect(fr[key].other, `fr:${key}`).toBeTruthy();
    }
  });

  it("use the same placeholders in every locale", () => {
    for (const key of keys) {
      const enPlaceholders = new Set(
        templates(en[key]).flatMap(placeholders),
      );
      const frPlaceholders = new Set(
        templates(fr[key]).flatMap(placeholders),
      );
      expect([...frPlaceholders].sort(), key).toEqual(
        [...enPlaceholders].sort(),
      );
    }
  });
});

describe("translate", () => {
  it("interpolates named parameters", () => {
    expect(t("home.greeting", { username: "Ada" })).toBe("Hello, Ada!");
    expect(f("home.greeting", { username: "Ada" })).toBe("Bonjour, Ada !");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(translate("en", "home.greeting")).toBe("Hello, {username}!");
  });

  it("falls back to the key itself for unknown messages", () => {
    expect(translate("en", "does.not.exist" as MessageKey)).toBe(
      "does.not.exist",
    );
  });

  it("selects plural forms for the active locale", () => {
    expect(t("settings.data.exported", { count: 1 })).toBe("1 dish exported");
    expect(t("settings.data.exported", { count: 2 })).toBe("2 dishes exported");
    expect(f("settings.data.exported", { count: 1 })).toBe("1 plat exporté");
    expect(f("settings.data.exported", { count: 2 })).toBe("2 plats exportés");
  });
});

describe("browser detection", () => {
  it("matches the base language tag", () => {
    setNavigatorLanguages(["fr-FR"]);
    expect(detectBrowserLocale()).toBe("fr");

    setNavigatorLanguages(["en-GB"]);
    expect(detectBrowserLocale()).toBe("en");
  });

  it("uses the first supported browser language", () => {
    setNavigatorLanguages(["es-ES", "fr-FR", "en-US"]);
    expect(detectBrowserLocale()).toBe("fr");
  });

  it("falls back to English when nothing is supported", () => {
    setNavigatorLanguages(["de-DE", "it-IT"]);
    expect(detectBrowserLocale()).toBe("en");
  });

  it("falls back to English when the browser exposes nothing", () => {
    setNavigatorLanguages([], "");
    expect(detectBrowserLocale()).toBe("en");
  });

  it("prefers a stored choice over the browser", () => {
    setNavigatorLanguages(["fr-FR"]);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    __resetI18nForTests(null);

    expect(getLocale()).toBe("en");
  });

  it("ignores an unsupported stored choice", () => {
    setNavigatorLanguages(["fr-FR"]);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "de");
    __resetI18nForTests(null);

    expect(getLocale()).toBe("fr");
  });
});

describe("locale switching", () => {
  it("persists an explicit choice and updates the document language", () => {
    setLocale("fr");

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("fr");
    expect(document.documentElement.lang).toBe("fr");

    setLocale("en");

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("ignores unsupported locales", () => {
    setLocale("de" as Locale);
    expect(getLocale()).toBe("en");
  });

  it("updates every subscriber without a reload", () => {
    const { result } = renderHook(() => useTranslation());

    expect(result.current.locale).toBe("en");
    expect(result.current.t("settings.title")).toBe("Settings");

    act(() => setLocale("fr"));

    expect(result.current.locale).toBe("fr");
    expect(result.current.t("settings.title")).toBe("Paramètres");
    expect(document.documentElement.lang).toBe("fr");
  });

  it("covers every supported locale in LOCALES", () => {
    expect(LOCALES).toEqual(["en", "fr"]);
  });
});

describe("locale-aware formatting", () => {
  const date = new Date("2026-08-25T09:21:00Z");

  it("formats dates with the active locale", () => {
    const { result } = renderHook(() => useTranslation());

    expect(result.current.formatDate(date)).toBe(
      new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date),
    );

    act(() => setLocale("fr"));

    expect(result.current.formatDate(date)).toBe(
      new Intl.DateTimeFormat("fr", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date),
    );
  });

  it("formats times and long date-times with the active locale", () => {
    const { result } = renderHook(() => useTranslation());

    act(() => setLocale("fr"));

    expect(result.current.formatTime(date)).toBe(
      new Intl.DateTimeFormat("fr", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date),
    );
    expect(result.current.formatDateTime(date)).toBe(
      new Intl.DateTimeFormat("fr", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(date),
    );
  });

  it("formats numbers with the active locale", () => {
    const { result } = renderHook(() => useTranslation());

    expect(result.current.formatNumber(1234.5)).toBe(
      new Intl.NumberFormat("en").format(1234.5),
    );
  });
});
