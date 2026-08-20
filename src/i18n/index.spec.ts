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
  it('starts from the default language', () => {
    expect(i18n.global.locale.value).toBe(DEFAULT_SETTINGS.locale);
  });

  it('changes the active language', () => {
    setI18nLocale('en');

    expect(i18n.global.locale.value).toBe('en');
    expect(i18n.global.t('settings.title')).toBe('Settings');
  });

  it('exposes the same keys in every language', () => {
    const italianKeys = flattenKeys(italianMessages).sort();
    const englishKeys = flattenKeys(englishMessages).sort();

    expect(englishKeys).toEqual(italianKeys);
  });

  it('does not leave empty translations', () => {
    const keys = flattenKeys(italianMessages);

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((key) => i18n.global.t(key).length > 0)).toBe(true);
  });
});

describe('isSupportedLocale', () => {
  it('recognizes declared languages', () => {
    expect(LOCALES.every((locale) => isSupportedLocale(locale))).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isSupportedLocale('de')).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });
});

describe('detectLocale', () => {
  it('sceglie la first preferenza supportata', () => {
    expect(detectLocale(['en-US', 'it-IT'])).toBe('en');
    expect(detectLocale(['de-DE', 'it-IT'])).toBe('it');
  });

  it('ignores the region code', () => {
    expect(detectLocale(['EN-gb'])).toBe('en');
  });

  it('falls back to the default language', () => {
    expect(detectLocale([])).toBe(DEFAULT_SETTINGS.locale);
    expect(detectLocale(['de', 'fr'])).toBe(DEFAULT_SETTINGS.locale);
  });

  it('reads browser preferences', () => {
    expect(LOCALES).toContain(detectBrowserLocale());
  });
});
