import { afterEach, describe, expect, it } from 'vitest';

import englishMessages from '@/locales/en.json';
import italianMessages from '@/locales/it.json';
import { DEFAULT_SETTINGS, LOCALES } from '@/types/settings';

import { detectBrowserLocale, detectLocale, i18n, isSupportedLocale, setI18nLocale } from './index';

function flattenKeys(source: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return typeof value === 'object' && value !== null
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

afterEach(() => {
  setI18nLocale(DEFAULT_SETTINGS.locale);
});

describe('i18n', () => {
  it('parte dalla lingua predefinita', () => {
    expect(i18n.global.locale.value).toBe(DEFAULT_SETTINGS.locale);
  });

  it('cambia la lingua attiva', () => {
    setI18nLocale('en');

    expect(i18n.global.locale.value).toBe('en');
    expect(i18n.global.t('settings.title')).toBe('Settings');
  });

  it('espone le stesse chiavi in tutte le lingue', () => {
    const italianKeys = flattenKeys(italianMessages).sort();
    const englishKeys = flattenKeys(englishMessages).sort();

    expect(englishKeys).toEqual(italianKeys);
  });

  it('non lascia traduzioni vuote', () => {
    const keys = flattenKeys(italianMessages);

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((key) => i18n.global.t(key).length > 0)).toBe(true);
  });
});

describe('isSupportedLocale', () => {
  it('riconosce le lingue dichiarate', () => {
    expect(LOCALES.every((locale) => isSupportedLocale(locale))).toBe(true);
  });

  it('rifiuta valori sconosciuti', () => {
    expect(isSupportedLocale('de')).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });
});

describe('detectLocale', () => {
  it('sceglie la prima preferenza supportata', () => {
    expect(detectLocale(['en-US', 'it-IT'])).toBe('en');
    expect(detectLocale(['de-DE', 'it-IT'])).toBe('it');
  });

  it('ignora il codice di regione', () => {
    expect(detectLocale(['EN-gb'])).toBe('en');
  });

  it('ricade sulla lingua predefinita', () => {
    expect(detectLocale([])).toBe(DEFAULT_SETTINGS.locale);
    expect(detectLocale(['de', 'fr'])).toBe(DEFAULT_SETTINGS.locale);
  });

  it('legge le preferenze del browser', () => {
    expect(LOCALES).toContain(detectBrowserLocale());
  });
});
