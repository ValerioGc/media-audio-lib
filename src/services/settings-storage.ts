import { isTauriRuntime } from '@/config/app-config';
import {
  DEFAULT_SETTINGS,
  LOCALES,
  TEXT_SIZES,
  THEME_CHOICES,
  VIEW_MODES,
  type AppSettings,
} from '@/types/settings';

const STORE_FILE = 'settings.json';
const STORE_KEY = 'app-settings';

export interface SettingsStorage {
  load(): Promise<Partial<AppSettings>>;
  save(settings: AppSettings): Promise<void>;
}

function pickKnown<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function pickNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Turns untrusted persisted data into a complete, valid settings object. */
export function sanitizeSettings(raw: unknown): AppSettings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  return {
    locale: pickKnown(LOCALES, source.locale, DEFAULT_SETTINGS.locale),
    textSize: pickKnown(TEXT_SIZES, source.textSize, DEFAULT_SETTINGS.textSize),
    theme: pickKnown(THEME_CHOICES, source.theme, DEFAULT_SETTINGS.theme),
    viewMode: pickKnown(VIEW_MODES, source.viewMode, DEFAULT_SETTINGS.viewMode),
    coverGradientEnabled:
      typeof source.coverGradientEnabled === 'boolean'
        ? source.coverGradientEnabled
        : DEFAULT_SETTINGS.coverGradientEnabled,
    playerTransparency: pickNumber(
      source.playerTransparency,
      DEFAULT_SETTINGS.playerTransparency,
      0,
      45,
    ),
    playerBlur: pickNumber(source.playerBlur, DEFAULT_SETTINGS.playerBlur, 0, 28),
  };
}

export function createWebStorage(storage: Storage): SettingsStorage {
  return {
    load: async () => {
      const raw = storage.getItem(STORE_KEY);
      return raw === null ? {} : (JSON.parse(raw) as Partial<AppSettings>);
    },
    save: async (settings) => {
      storage.setItem(STORE_KEY, JSON.stringify(settings));
    },
  };
}

export function createTauriStorage(): SettingsStorage {
  const openStore = async () => {
    const { load } = await import('@tauri-apps/plugin-store');
    return load(STORE_FILE, { autoSave: false });
  };

  return {
    load: async () => {
      const store = await openStore();
      const raw = await store.get<Partial<AppSettings>>(STORE_KEY);
      return raw ?? {};
    },
    save: async (settings) => {
      const store = await openStore();
      await store.set(STORE_KEY, settings);
      await store.save();
    },
  };
}

export function createSettingsStorage(): SettingsStorage {
  if (isTauriRuntime()) {
    return createTauriStorage();
  }

  if (typeof localStorage !== 'undefined') {
    return createWebStorage(localStorage);
  }

  return { load: async () => ({}), save: async () => {} };
}
