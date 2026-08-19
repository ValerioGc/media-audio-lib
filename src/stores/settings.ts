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
  type AppSettings,
  type Locale,
  type ResolvedTheme,
  type TextSize,
  type ThemeChoice,
  type ViewMode,
} from '@/types/settings';

export const useSettingsStore = defineStore('settings', () => {
  const locale = ref<Locale>(DEFAULT_SETTINGS.locale);
  const textSize = ref<TextSize>(DEFAULT_SETTINGS.textSize);
  const theme = ref<ThemeChoice>(DEFAULT_SETTINGS.theme);
  const viewMode = ref<ViewMode>(DEFAULT_SETTINGS.viewMode);
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

  async function setTheme(next: ThemeChoice) {
    theme.value = next;
    apply();
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
    systemTheme,
    isReady,
    resolvedTheme,
    settings,
    initialize,
    setLocale,
    setTextSize,
    setTheme,
    setViewMode,
    dispose,
  };
});
