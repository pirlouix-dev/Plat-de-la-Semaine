export const LOCALES = ["en", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_OPTIONS: ReadonlyArray<{ id: Locale; label: string }> = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
];

export type InterpolationParams = Record<string, string | number>;

export type PluralForms = {
  one: string;
  other: string;
} & Partial<Record<"zero" | "two" | "few" | "many", string>>;

export type MessageValue = string | PluralForms;

export type Translate = (
  key: MessageKey,
  params?: InterpolationParams,
) => string;

// Kept here as a type-only reference so catalogues and consumers share one name
// without introducing a runtime cycle.
export type MessageKey = import("./locales/en").MessageKey;
