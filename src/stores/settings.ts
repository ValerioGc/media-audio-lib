import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { detectBrowserLocale, setI18nLocale } from '@/i18n';
import { applyDocumentLocale, applyTextSize, applyTheme } from '@/services/appearance';
import {
  createSettingsStorage,
  sanitizeSettings,
  type SettingsStorage,
} from '@/services/settings-storage';
import { getSystemTheme, watchSystemTheme } from '@/services/system-theme';
import {
  DEFAULT_SETTINGS,
  LOCKED_LEADING_TABLE_COLUMN_KEYS,
  MANDATORY_TABLE_COLUMN_KEYS,
  MAX_COVER_GRADIENT_INTENSITY,
  MAX_PLAYER_BLUR,
  MIN_COVER_GRADIENT_INTENSITY,
  TABLE_COLUMN_WIDTHS,
  type AppSettings,
  type Locale,
  type ResolvedTheme,
  type TableColumnKey,
  type TableColumnSetting,
  type TextSize,
  type ThemeChoice,
  type ViewMode,
} from '@/types/settings';

export const useSettingsStore = defineStore('settings', () => {
  const locale = ref<Locale>(DEFAULT_SETTINGS.locale);
  const textSize = ref<TextSize>(DEFAULT_SETTINGS.textSize);
  const theme = ref<ThemeChoice>(DEFAULT_SETTINGS.theme);
  const viewMode = ref<ViewMode>(DEFAULT_SETTINGS.viewMode);
  const mainLibraryId = ref<string | null>(DEFAULT_SETTINGS.mainLibraryId);
  const coverGradientEnabled = ref(DEFAULT_SETTINGS.coverGradientEnabled);
  const coverGradientIntensity = ref(DEFAULT_SETTINGS.coverGradientIntensity);
  const playerTransparency = ref(DEFAULT_SETTINGS.playerTransparency);
  const playerBlur = ref(DEFAULT_SETTINGS.playerBlur);
  const defaultPlayerBannerDismissed = ref(DEFAULT_SETTINGS.defaultPlayerBannerDismissed);
  const tableColumns = ref<TableColumnSetting[]>(
    DEFAULT_SETTINGS.tableColumns.map((column) => ({ ...column })),
  );
  const systemTheme = ref<ResolvedTheme>('light');
  const isReady = ref(false);

  let storage: SettingsStorage | null = null;
  let stopSystemWatch: (() => void) | null = null;

  const resolvedTheme = computed<ResolvedTheme>(() =>
    theme.value === 'system' ? systemTheme.value : theme.value,
  );

  const settings = computed<AppSettings>(() => ({
    locale: locale.value,
    textSize: textSize.value,
    theme: theme.value,
    viewMode: viewMode.value,
    mainLibraryId: mainLibraryId.value,
    coverGradientEnabled: coverGradientEnabled.value,
    coverGradientIntensity: coverGradientIntensity.value,
    playerTransparency: playerTransparency.value,
    playerBlur: playerBlur.value,
    defaultPlayerBannerDismissed: defaultPlayerBannerDismissed.value,
    tableColumns: tableColumns.value,
  }));

  function apply() {
    applyTheme(resolvedTheme.value);
    applyTextSize(textSize.value);
    applyDocumentLocale(locale.value);
    setI18nLocale(locale.value);
  }

  async function persist() {
    try {
      await storage?.save(settings.value);
    } catch (error) {
      console.error('Unable to persist the application settings', error);
    }
  }

  async function readStored(): Promise<Partial<AppSettings>> {
    try {
      return (await storage?.load()) ?? {};
    } catch (error) {
      console.error('Unable to read the persisted settings, falling back to defaults', error);
      return {};
    }
  }

  /** Loads the persisted preferences, applies them and starts following the system theme. */
  async function initialize(injectedStorage?: SettingsStorage) {
    storage = injectedStorage ?? createSettingsStorage();

    systemTheme.value = getSystemTheme();
    stopSystemWatch?.();
    stopSystemWatch = watchSystemTheme((next) => {
      systemTheme.value = next;
      apply();
    });

    const stored = await readStored();
    const restored = sanitizeSettings({
      ...stored,
      locale: stored.locale ?? detectBrowserLocale(),
    });

    locale.value = restored.locale;
    textSize.value = restored.textSize;
    theme.value = restored.theme;
    viewMode.value = restored.viewMode;
    mainLibraryId.value = restored.mainLibraryId;
    coverGradientEnabled.value = restored.coverGradientEnabled;
    coverGradientIntensity.value = restored.coverGradientIntensity;
    playerTransparency.value = restored.playerTransparency;
    playerBlur.value = restored.playerBlur;
    defaultPlayerBannerDismissed.value = restored.defaultPlayerBannerDismissed;
    tableColumns.value = restored.tableColumns.map((column) => ({ ...column }));

    apply();
    isReady.value = true;
  }

  async function setLocale(next: Locale) {
    locale.value = next;
    apply();
    await persist();
  }

  async function setTextSize(next: TextSize) {
    textSize.value = next;
    apply();
    await persist();
  }

  // The chosen library view is remembered across sessions.
  async function setViewMode(next: ViewMode) {
    viewMode.value = next;
    await persist();
  }

  async function setMainLibraryId(id: string | null) {
    mainLibraryId.value = id;
    await persist();
  }

  async function setTheme(next: ThemeChoice) {
    theme.value = next;
    apply();
    await persist();
  }

  async function setCoverGradientEnabled(next: boolean) {
    coverGradientEnabled.value = next;
    await persist();
  }

  async function setCoverGradientIntensity(next: number) {
    coverGradientIntensity.value = Math.min(
      MAX_COVER_GRADIENT_INTENSITY,
      Math.max(MIN_COVER_GRADIENT_INTENSITY, next),
    );
    await persist();
  }

  async function setPlayerTransparency(next: number) {
    playerTransparency.value = Math.min(45, Math.max(0, next));
    await persist();
  }

  async function setPlayerBlur(next: number) {
    playerBlur.value = Math.min(MAX_PLAYER_BLUR, Math.max(0, next));
    await persist();
  }

  async function dismissDefaultPlayerBanner() {
    defaultPlayerBannerDismissed.value = true;
    await persist();
  }

  function isMandatoryTableColumn(key: TableColumnKey): boolean {
    return MANDATORY_TABLE_COLUMN_KEYS.includes(
      key as (typeof MANDATORY_TABLE_COLUMN_KEYS)[number],
    );
  }

  function isLockedLeadingTableColumn(key: TableColumnKey): boolean {
    return LOCKED_LEADING_TABLE_COLUMN_KEYS.includes(
      key as (typeof LOCKED_LEADING_TABLE_COLUMN_KEYS)[number],
    );
  }

  function normalizeTableColumnOrder(columns: readonly TableColumnSetting[]): TableColumnSetting[] {
    const locked = LOCKED_LEADING_TABLE_COLUMN_KEYS.map((key) =>
      columns.find((column) => column.key === key),
    ).filter((column): column is TableColumnSetting => column !== undefined);
    const lockedKeys = new Set<TableColumnKey>(LOCKED_LEADING_TABLE_COLUMN_KEYS);

    return [...locked, ...columns.filter((column) => !lockedKeys.has(column.key))];
  }

  async function setTableColumnVisible(key: TableColumnKey, visible: boolean) {
    tableColumns.value = tableColumns.value.map((column) =>
      column.key === key
        ? { ...column, visible: isMandatoryTableColumn(key) ? true : visible }
        : column,
    );
    await persist();
  }

  async function setTableColumnWidth(key: TableColumnKey, width: number) {
    const limits = TABLE_COLUMN_WIDTHS[key];
    tableColumns.value = tableColumns.value.map((column) =>
      column.key === key
        ? { ...column, width: Math.min(limits.max, Math.max(limits.min, width)) }
        : column,
    );
    await persist();
  }

  async function moveTableColumn(key: TableColumnKey, targetKey: TableColumnKey) {
    if (key === targetKey || isLockedLeadingTableColumn(key)) {
      return;
    }

    const columns = tableColumns.value.filter((column) => column.key !== key);
    const moved = tableColumns.value.find((column) => column.key === key);
    const rawTargetIndex = columns.findIndex((column) => column.key === targetKey);

    if (moved === undefined || rawTargetIndex < 0) {
      return;
    }

    const lockedCount = LOCKED_LEADING_TABLE_COLUMN_KEYS.length;
    const targetIndex = Math.max(rawTargetIndex, lockedCount);

    columns.splice(targetIndex, 0, moved);
    tableColumns.value = normalizeTableColumnOrder(columns);
    await persist();
  }

  async function nudgeTableColumn(key: TableColumnKey, direction: -1 | 1) {
    if (isLockedLeadingTableColumn(key)) {
      return;
    }

    const index = tableColumns.value.findIndex((column) => column.key === key);
    const target = tableColumns.value[index + direction];

    if (index < 0 || target === undefined || isLockedLeadingTableColumn(target.key)) {
      return;
    }

    const columns = [...tableColumns.value];
    columns.splice(index, 1);
    columns.splice(index + direction, 0, tableColumns.value[index]!);
    tableColumns.value = normalizeTableColumnOrder(columns);
    await persist();
  }

  async function resetTableColumns() {
    tableColumns.value = DEFAULT_SETTINGS.tableColumns.map((column) => ({ ...column }));
    await persist();
  }

  function dispose() {
    stopSystemWatch?.();
    stopSystemWatch = null;
  }

  return {
    locale,
    textSize,
    theme,
    viewMode,
    mainLibraryId,
    coverGradientEnabled,
    coverGradientIntensity,
    playerTransparency,
    playerBlur,
    defaultPlayerBannerDismissed,
    tableColumns,
    systemTheme,
    isReady,
    resolvedTheme,
    settings,
    initialize,
    setLocale,
    setTextSize,
    setTheme,
    setViewMode,
    setMainLibraryId,
    setCoverGradientEnabled,
    setCoverGradientIntensity,
    setPlayerTransparency,
    setPlayerBlur,
    dismissDefaultPlayerBanner,
    setTableColumnVisible,
    setTableColumnWidth,
    moveTableColumn,
    nudgeTableColumn,
    resetTableColumns,
    dispose,
  };
});
