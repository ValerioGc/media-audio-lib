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

  it('keeps valid values', () => {
    const settings: AppSettings = {
      locale: 'en',
      textSize: 'large',
      theme: 'dark',
      viewMode: 'preview',
      mainLibraryId: 'lib-2',
      coverGradientEnabled: false,
      coverGradientIntensity: 150,
      playerTransparency: 30,
      playerBlur: 18,
      defaultPlayerBannerDismissed: true,
    };

    expect(sanitizeSettings(settings)).toEqual(settings);
  });

  it('discards individual invalid fields while keeping the others', () => {
    const sanitized = sanitizeSettings({ locale: 'de', textSize: 'large', theme: 'neon' });

    expect(sanitized).toEqual({
      locale: DEFAULT_SETTINGS.locale,
      textSize: 'large',
      theme: DEFAULT_SETTINGS.theme,
      viewMode: DEFAULT_SETTINGS.viewMode,
      mainLibraryId: DEFAULT_SETTINGS.mainLibraryId,
      coverGradientEnabled: DEFAULT_SETTINGS.coverGradientEnabled,
      coverGradientIntensity: DEFAULT_SETTINGS.coverGradientIntensity,
      playerTransparency: DEFAULT_SETTINGS.playerTransparency,
      playerBlur: DEFAULT_SETTINGS.playerBlur,
      defaultPlayerBannerDismissed: DEFAULT_SETTINGS.defaultPlayerBannerDismissed,
    });
  });

  it('clamps saved gradient, transparency and blur to valid values', () => {
    expect(
      sanitizeSettings({ coverGradientIntensity: 400, playerTransparency: 80, playerBlur: -4 }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      coverGradientIntensity: 200,
      playerTransparency: 45,
      playerBlur: 0,
    });
  });
});

describe('createWebStorage', () => {
  it('returns an empty object when nothing is saved', async () => {
    const storage = createWebStorage(createFakeStorage());

    await expect(storage.load()).resolves.toEqual({});
  });

  it('round-trips settings', async () => {
    const storage = createWebStorage(createFakeStorage());
    const settings: AppSettings = {
      locale: 'en',
      textSize: 'small',
      theme: 'light',
      viewMode: 'table',
      mainLibraryId: null,
      coverGradientEnabled: true,
      coverGradientIntensity: 100,
      playerTransparency: 12,
      playerBlur: 12,
      defaultPlayerBannerDismissed: false,
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

  it('reads settings from the plugin store', async () => {
    const settings: AppSettings = {
      locale: 'en',
      textSize: 'large',
      theme: 'dark',
      viewMode: 'preview',
      mainLibraryId: 'lib-2',
      coverGradientEnabled: false,
      coverGradientIntensity: 150,
      playerTransparency: 30,
      playerBlur: 18,
      defaultPlayerBannerDismissed: true,
    };
    mocks.store.get.mockResolvedValue(settings);

    await expect(createTauriStorage().load()).resolves.toEqual(settings);
    expect(mocks.load).toHaveBeenCalledWith('settings.json', { autoSave: false });
  });

  it('returns an empty object when the key does not exist', async () => {
    await expect(createTauriStorage().load()).resolves.toEqual({});
  });

  it('writes and persists to disk', async () => {
    await createTauriStorage().save(DEFAULT_SETTINGS);

    expect(mocks.store.set).toHaveBeenCalledWith('app-settings', DEFAULT_SETTINGS);
    expect(mocks.store.save).toHaveBeenCalledTimes(1);
  });
});

describe('createSettingsStorage', () => {
  it('uses the Tauri plugin when the app runs in the shell', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    mocks.store.get.mockResolvedValue(undefined);

    await createSettingsStorage().load();

    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it('uses localStorage in the browser', async () => {
    const storage = createSettingsStorage();
    await storage.save({
      locale: 'en',
      textSize: 'small',
      theme: 'light',
      viewMode: 'table',
      mainLibraryId: 'lib-1',
      coverGradientEnabled: false,
      coverGradientIntensity: 120,
      playerTransparency: 20,
      playerBlur: 10,
      defaultPlayerBannerDismissed: true,
    });

    await expect(storage.load()).resolves.toEqual({
      locale: 'en',
      textSize: 'small',
      theme: 'light',
      viewMode: 'table',
      mainLibraryId: 'lib-1',
      coverGradientEnabled: false,
      coverGradientIntensity: 120,
      playerTransparency: 20,
      playerBlur: 10,
      defaultPlayerBannerDismissed: true,
    });
    expect(mocks.load).not.toHaveBeenCalled();

    localStorage.clear();
  });
});
