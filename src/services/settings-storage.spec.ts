import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings';

import {
  createSettingsStorage,
  createTauriStorage,
  createWebStorage,
  sanitizeSettings,
} from './settings-storage';

const mocks = vi.hoisted(() => ({
  store: {
    get: vi.fn(),
    set: vi.fn(),
    save: vi.fn(),
  },
  load: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  load: (...args: unknown[]) => {
    mocks.load(...args);
    return Promise.resolve(mocks.store);
  },
}));

function createFakeStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
    key: () => null,
    get length() {
      return entries.size;
    },
  } as Storage;
}

const scopedWindow = window as unknown as Record<string, unknown>;

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

describe('sanitizeSettings', () => {
  it('restituisce i valori predefiniti per dati assenti', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('non un oggetto')).toEqual(DEFAULT_SETTINGS);
  });

  it('conserva i valori validi', () => {
    const settings: AppSettings = {
      locale: 'en',
      textSize: 'large',
      theme: 'dark',
      viewMode: 'preview',
      coverGradientEnabled: false,
    };

    expect(sanitizeSettings(settings)).toEqual(settings);
  });

  it('scarta i singoli campi non validi mantenendo gli altri', () => {
    const sanitized = sanitizeSettings({ locale: 'de', textSize: 'large', theme: 'neon' });

    expect(sanitized).toEqual({
      locale: DEFAULT_SETTINGS.locale,
      textSize: 'large',
      theme: DEFAULT_SETTINGS.theme,
      viewMode: DEFAULT_SETTINGS.viewMode,
      coverGradientEnabled: DEFAULT_SETTINGS.coverGradientEnabled,
    });
  });
});

describe('createWebStorage', () => {
  it('restituisce un oggetto vuoto quando non c e nulla di salvato', async () => {
    const storage = createWebStorage(createFakeStorage());

    await expect(storage.load()).resolves.toEqual({});
  });

  it('esegue il round-trip delle impostazioni', async () => {
    const storage = createWebStorage(createFakeStorage());
    const settings: AppSettings = {
      locale: 'en',
      textSize: 'small',
      theme: 'light',
      viewMode: 'table',
      coverGradientEnabled: true,
    };

    await storage.save(settings);

    await expect(storage.load()).resolves.toEqual(settings);
  });
});

describe('createTauriStorage', () => {
  beforeEach(() => {
    mocks.store.get.mockResolvedValue(undefined);
    mocks.store.set.mockResolvedValue(undefined);
    mocks.store.save.mockResolvedValue(undefined);
  });

  it('legge le impostazioni dallo store del plugin', async () => {
    const settings: AppSettings = {
      locale: 'en',
      textSize: 'large',
      theme: 'dark',
      viewMode: 'preview',
      coverGradientEnabled: false,
    };
    mocks.store.get.mockResolvedValue(settings);

    await expect(createTauriStorage().load()).resolves.toEqual(settings);
    expect(mocks.load).toHaveBeenCalledWith('settings.json', { autoSave: false });
  });

  it('restituisce un oggetto vuoto quando la chiave non esiste', async () => {
    await expect(createTauriStorage().load()).resolves.toEqual({});
  });

  it('scrive e persiste su disco', async () => {
    await createTauriStorage().save(DEFAULT_SETTINGS);

    expect(mocks.store.set).toHaveBeenCalledWith('app-settings', DEFAULT_SETTINGS);
    expect(mocks.store.save).toHaveBeenCalledTimes(1);
  });
});

describe('createSettingsStorage', () => {
  it('usa il plugin Tauri quando l app gira nella shell', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    mocks.store.get.mockResolvedValue(undefined);

    await createSettingsStorage().load();

    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it('usa localStorage nel browser', async () => {
    const storage = createSettingsStorage();
    await storage.save({
      locale: 'en',
      textSize: 'small',
      theme: 'light',
      viewMode: 'table',
      coverGradientEnabled: false,
    });

    await expect(storage.load()).resolves.toEqual({
      locale: 'en',
      textSize: 'small',
      theme: 'light',
      viewMode: 'table',
      coverGradientEnabled: false,
    });
    expect(mocks.load).not.toHaveBeenCalled();

    localStorage.clear();
  });
});
