import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getLocale, setLocale, subscribeLocale } from "./localeStore";
import { createTranslator } from "./translate";
import type { Locale, Translate } from "./types";

const SHORT_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

const TIME: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

const LONG_DATE_TIME: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

type DateInput = Date | string;

function formatWith(
  locale: Locale,
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export interface I18n {
  t: Translate;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  formatDate: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (
    value: DateInput,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatNumber: (value: number) => string;
}

export function useTranslation(): I18n {
  const locale = useSyncExternalStore(subscribeLocale, getLocale);
  const t = useMemo(() => createTranslator(locale), [locale]);

  const formatDate = useCallback(
    (value: DateInput, options: Intl.DateTimeFormatOptions = SHORT_DATE) =>
      formatWith(locale, value, options),
    [locale],
  );
  const formatTime = useCallback(
    (value: DateInput, options: Intl.DateTimeFormatOptions = TIME) =>
      formatWith(locale, value, options),
    [locale],
  );
  const formatDateTime = useCallback(
    (
      value: DateInput,
      options: Intl.DateTimeFormatOptions = LONG_DATE_TIME,
    ) => formatWith(locale, value, options),
    [locale],
  );
  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(locale).format(value),
    [locale],
  );

  return {
    t,
    locale,
    setLocale,
    formatDate,
    formatTime,
    formatDateTime,
    formatNumber,
  };
}
