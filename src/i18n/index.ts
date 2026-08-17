import { createI18n } from 'vue-i18n';

import en from '@/locales/en.json';
import it from '@/locales/it.json';
import { DEFAULT_SETTINGS, LOCALES, type Locale } from '@/types/settings';

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_SETTINGS.locale,
  fallbackLocale: DEFAULT_SETTINGS.locale,
  messages: { it, en },
});

export function isSupportedLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Picks the first supported locale out of the browser preferences. */
export function detectLocale(preferences: readonly string[]): Locale {
  for (const preference of preferences) {
    const language = preference.split('-')[0]?.toLowerCase();

    if (isSupportedLocale(language)) {
      return language;
    }
  }

  return DEFAULT_SETTINGS.locale;
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return DEFAULT_SETTINGS.locale;
  }

  return detectLocale(navigator.languages ?? [navigator.language]);
}

export function setI18nLocale(locale: Locale) {
  i18n.global.locale.value = locale;
}
