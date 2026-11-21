import { en } from "./locales/en";
import type { MessageKey } from "./locales/en";
import { fr } from "./locales/fr";
import {
  DEFAULT_LOCALE,
  type InterpolationParams,
  type Locale,
  type MessageValue,
  type PluralForms,
  type Translate,
} from "./types";

const CATALOGS: Record<Locale, Record<MessageKey, MessageValue>> = { en, fr };

function interpolate(
  template: string,
  params?: InterpolationParams,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

function selectPluralForm(
  forms: PluralForms,
  locale: Locale,
  params?: InterpolationParams,
): string {
  const count = params?.count;
  const category =
    typeof count === "number"
      ? new Intl.PluralRules(locale).select(count)
      : "other";
  return forms[category] ?? forms.other;
}

/**
 * Resolve a message key for a locale. Unknown keys fall back to English and
 * then to the key itself, so a missing entry is visible instead of blank.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: InterpolationParams,
): string {
  const value = CATALOGS[locale][key] ?? CATALOGS[DEFAULT_LOCALE][key];
  if (value === undefined) return key;

  const template =
    typeof value === "string"
      ? value
      : selectPluralForm(value, locale, params);
  return interpolate(template, params);
}

export function createTranslator(locale: Locale): Translate {
  return (key, params) => translate(locale, key, params);
}
