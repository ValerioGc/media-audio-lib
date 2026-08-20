import { isTauriRuntime } from '@/config/app-config';
import { normalizeAccentColor } from '@/services/accent';
import {
  DEFAULT_SETTINGS,
  DEFAULT_TABLE_COLUMNS,
  LOCKED_LEADING_TABLE_COLUMN_KEYS,
  LOCALES,
  MANDATORY_TABLE_COLUMN_KEYS,
  MAX_COVER_GRADIENT_INTENSITY,
  MAX_PLAYER_BLUR,
  MIN_COVER_GRADIENT_INTENSITY,
  TABLE_COLUMN_KEYS,
  TABLE_COLUMN_WIDTHS,
  TEXT_SIZES,
  THEME_CHOICES,
  VIEW_MODES,
  type AppSettings,
  type TableColumnKey,
  type TableColumnSetting,
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

function isTableColumnKey(value: unknown): value is TableColumnKey {
  return TABLE_COLUMN_KEYS.includes(value as TableColumnKey);
}

function isMandatoryTableColumn(key: TableColumnKey): boolean {
  return MANDATORY_TABLE_COLUMN_KEYS.includes(key as (typeof MANDATORY_TABLE_COLUMN_KEYS)[number]);
}

function normalizeTableColumnOrder(columns: readonly TableColumnSetting[]): TableColumnSetting[] {
  const locked = LOCKED_LEADING_TABLE_COLUMN_KEYS.map((key) =>
    columns.find((column) => column.key === key),
  ).filter((column): column is TableColumnSetting => column !== undefined);
  const lockedKeys = new Set<TableColumnKey>(LOCKED_LEADING_TABLE_COLUMN_KEYS);

  return [...locked, ...columns.filter((column) => !lockedKeys.has(column.key))];
}

function sanitizeTableColumns(value: unknown): TableColumnSetting[] {
  const stored = Array.isArray(value) ? value : [];
  const byDefault = new Map(DEFAULT_TABLE_COLUMNS.map((column) => [column.key, column]));
  const seen = new Set<TableColumnKey>();
  const columns: TableColumnSetting[] = [];

  for (const raw of stored) {
    if (typeof raw !== 'object' || raw === null) {
      continue;
    }

    const source = raw as Record<string, unknown>;

    if (!isTableColumnKey(source.key) || seen.has(source.key)) {
      continue;
    }

    const limits = TABLE_COLUMN_WIDTHS[source.key];
    const fallback = byDefault.get(source.key) ?? {
      key: source.key,
      visible: true,
      width: limits.default,
    };

    columns.push({
      key: source.key,
      visible: isMandatoryTableColumn(source.key)
        ? true
        : typeof source.visible === 'boolean'
          ? source.visible
          : fallback.visible,
      width: pickNumber(source.width, fallback.width, limits.min, limits.max),
    });
    seen.add(source.key);
  }

  for (const column of DEFAULT_TABLE_COLUMNS) {
    if (!seen.has(column.key)) {
      columns.push({ ...column });
    }
  }

  return normalizeTableColumnOrder(columns);
}

/** Turns untrusted persisted data into a complete, valid settings object. */
export function sanitizeSettings(raw: unknown): AppSettings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  return {
    locale: pickKnown(LOCALES, source.locale, DEFAULT_SETTINGS.locale),
    textSize: pickKnown(TEXT_SIZES, source.textSize, DEFAULT_SETTINGS.textSize),
    theme: pickKnown(THEME_CHOICES, source.theme, DEFAULT_SETTINGS.theme),
    accentColor: normalizeAccentColor(source.accentColor) ?? DEFAULT_SETTINGS.accentColor,
    ambientBackgroundEnabled:
      typeof source.ambientBackgroundEnabled === 'boolean'
        ? source.ambientBackgroundEnabled
        : DEFAULT_SETTINGS.ambientBackgroundEnabled,
    glassSurfacesEnabled:
      typeof source.glassSurfacesEnabled === 'boolean'
        ? source.glassSurfacesEnabled
        : DEFAULT_SETTINGS.glassSurfacesEnabled,
    viewMode: pickKnown(VIEW_MODES, source.viewMode, DEFAULT_SETTINGS.viewMode),
    mainLibraryId:
      typeof source.mainLibraryId === 'string' && source.mainLibraryId.trim().length > 0
        ? source.mainLibraryId
        : DEFAULT_SETTINGS.mainLibraryId,
    coverGradientEnabled:
      typeof source.coverGradientEnabled === 'boolean'
        ? source.coverGradientEnabled
        : DEFAULT_SETTINGS.coverGradientEnabled,
    coverGradientIntensity: pickNumber(
      source.coverGradientIntensity,
      DEFAULT_SETTINGS.coverGradientIntensity,
      MIN_COVER_GRADIENT_INTENSITY,
      MAX_COVER_GRADIENT_INTENSITY,
    ),
    playerTransparency: pickNumber(
      source.playerTransparency,
      DEFAULT_SETTINGS.playerTransparency,
      0,
      45,
    ),
    playerBlur: pickNumber(source.playerBlur, DEFAULT_SETTINGS.playerBlur, 0, MAX_PLAYER_BLUR),
    defaultPlayerBannerDismissed:
      typeof source.defaultPlayerBannerDismissed === 'boolean'
        ? source.defaultPlayerBannerDismissed
        : DEFAULT_SETTINGS.defaultPlayerBannerDismissed,
    tableColumns: sanitizeTableColumns(source.tableColumns),
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
