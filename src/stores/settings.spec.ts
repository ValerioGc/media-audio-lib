import { setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestPinia, resetI18n } from '../../tests/support/mount';
import { i18n } from '@/i18n';
import type { SettingsStorage } from '@/services/settings-storage';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings';

import { useSettingsStore } from './settings';

interface FakeQuery {
  matches: boolean;
  addEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void;
  removeEventListener: () => void;
}

const originalMatchMedia = window.matchMedia;
let systemListener: ((event: { matches: boolean }) => void) | null = null;

function stubSystemTheme(prefersDark: boolean) {
  const query: FakeQuery = {
    matches: prefersDark,
    addEventListener: (_type, listener) => {
      systemListener = listener;
    },
    removeEventListener: vi.fn(),
  };

  window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
}

function createFakeStorage(initial: Partial<AppSettings> = {}): SettingsStorage & {
  saved: AppSettings[];
} {
  const saved: AppSettings[] = [];

  return {
    saved,
    load: vi.fn(async () => initial),
    save: vi.fn(async (settings: AppSettings) => {
      saved.push(settings);
    }),
  };
}

beforeEach(() => {
  setActivePinia(createTestPinia());
  stubSystemTheme(false);
  systemListener = null;
  resetI18n();
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe('useSettingsStore', () => {
  it('starts from default values', () => {
    const store = useSettingsStore();

    expect(store.textSize).toBe(DEFAULT_SETTINGS.textSize);
    expect(store.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(store.isReady).toBe(false);
  });

  it('restores saved settings and applies them to the document', async () => {
    const store = useSettingsStore();

    await store.initialize(createFakeStorage({ locale: 'en', textSize: 'large', theme: 'dark' }));

    expect(store.locale).toBe('en');
    expect(store.textSize).toBe('large');
    expect(store.theme).toBe('dark');
    expect(store.isReady).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.lang).toBe('en');
    expect(i18n.global.locale.value).toBe('en');

    store.dispose();
  });

  it('discards invalid saved values', async () => {
    const store = useSettingsStore();

    await store.initialize(
      createFakeStorage({ textSize: 'gigante' } as unknown as Partial<AppSettings>),
    );

    expect(store.textSize).toBe(DEFAULT_SETTINGS.textSize);

    store.dispose();
  });

  it('uses the browser language on first launch', async () => {
    const store = useSettingsStore();
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB', 'it-IT']);

    await store.initialize(createFakeStorage());

    expect(store.locale).toBe('en');

    store.dispose();
  });

  it('ricade sui valori predefiniti se la read fallisce', async () => {
    const store = useSettingsStore();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage: SettingsStorage = {
      load: vi.fn(async () => {
        throw new Error('store non leggibile');
      }),
      save: vi.fn(async () => {}),
    };

    await store.initialize(storage);

    expect(store.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(store.isReady).toBe(true);
    expect(consoleError).toHaveBeenCalledTimes(1);

    store.dispose();
  });

  it('persists every change', async () => {
    const store = useSettingsStore();
    const storage = createFakeStorage();
    await store.initialize(storage);

    await store.setLocale('en');
    await store.setTextSize('small');
    await store.setTheme('light');

    expect(storage.saved).toHaveLength(3);
    expect(storage.saved.at(-1)).toEqual({
      ...DEFAULT_SETTINGS,
      locale: 'en',
      textSize: 'small',
      theme: 'light',
    });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--app_font_scale')).toBe('0.875');

    store.dispose();
  });

  it('remembers the selected library view', async () => {
    const store = useSettingsStore();
    const storage = createFakeStorage();
    await store.initialize(storage);

    await store.setViewMode('table');

    expect(store.viewMode).toBe('table');
    expect(storage.saved.at(-1)?.viewMode).toBe('table');

    store.dispose();
  });

  it('remembers the primary library', async () => {
    const store = useSettingsStore();
    const storage = createFakeStorage();
    await store.initialize(storage);

    await store.setMainLibraryId('lib-2');

    expect(store.mainLibraryId).toBe('lib-2');
    expect(storage.saved.at(-1)?.mainLibraryId).toBe('lib-2');

    store.dispose();
  });

  it('remembers table column visibility, width and order', async () => {
    const store = useSettingsStore();
    const storage = createFakeStorage();
    await store.initialize(storage);

    await store.setTableColumnVisible('artist', false);
    await store.setTableColumnVisible('format', true);
    await store.setTableColumnVisible('title', false);
    await store.setTableColumnWidth('title', 999);
    await store.moveTableColumn('genre', 'artist');

    expect(store.tableColumns.find((column) => column.key === 'artist')?.visible).toBe(false);
    expect(store.tableColumns.find((column) => column.key === 'format')?.visible).toBe(true);
    expect(store.tableColumns.find((column) => column.key === 'title')?.visible).toBe(true);
    expect(store.tableColumns.find((column) => column.key === 'title')?.width).toBe(520);
    expect(store.tableColumns.map((column) => column.key).slice(0, 5)).toEqual([
      'cover',
      'title',
      'genre',
      'artist',
      'album',
    ]);
    expect(storage.saved.at(-1)?.tableColumns).toEqual(store.tableColumns);

    store.dispose();
  });

  it('restores the view saved in a previous session', async () => {
    const store = useSettingsStore();

    await store.initialize(createFakeStorage({ viewMode: 'preview' }));

    expect(store.viewMode).toBe('preview');

    store.dispose();
  });

  it('discards an unknown view and returns to the list', async () => {
    const store = useSettingsStore();

    await store.initialize(
      createFakeStorage({ viewMode: 'copertine' } as unknown as Partial<AppSettings>),
    );

    expect(store.viewMode).toBe(DEFAULT_SETTINGS.viewMode);

    store.dispose();
  });

  it('remembers whether the cover gradient is disabled', async () => {
    const store = useSettingsStore();
    const storage = createFakeStorage();
    await store.initialize(storage);

    await store.setCoverGradientEnabled(false);

    expect(store.coverGradientEnabled).toBe(false);
    expect(storage.saved.at(-1)?.coverGradientEnabled).toBe(false);

    store.dispose();
  });

  it('remembers cover gradient intensity, player transparency and blur', async () => {
    const store = useSettingsStore();
    const storage = createFakeStorage();
    await store.initialize(storage);

    await store.setCoverGradientIntensity(160);
    await store.setPlayerTransparency(30);
    await store.setPlayerBlur(18);

    expect(store.coverGradientIntensity).toBe(160);
    expect(store.playerTransparency).toBe(30);
    expect(store.playerBlur).toBe(18);
    expect(storage.saved.at(-1)?.coverGradientIntensity).toBe(160);
    expect(storage.saved.at(-1)?.playerTransparency).toBe(30);
    expect(storage.saved.at(-1)?.playerBlur).toBe(18);

    store.dispose();
  });

  it('remembers when the default player banner is dismissed', async () => {
    const store = useSettingsStore();
    const storage = createFakeStorage();
    await store.initialize(storage);

    await store.dismissDefaultPlayerBanner();

    expect(store.defaultPlayerBannerDismissed).toBe(true);
    expect(storage.saved.at(-1)?.defaultPlayerBannerDismissed).toBe(true);

    store.dispose();
  });

  it('does not propagate write errors', async () => {
    const store = useSettingsStore();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await store.initialize({
      load: vi.fn(async () => ({})),
      save: vi.fn(async () => {
        throw new Error('disco pieno');
      }),
    });

    await expect(store.setTheme('dark')).resolves.toBeUndefined();
    expect(store.theme).toBe('dark');
    expect(consoleError).toHaveBeenCalledTimes(1);

    store.dispose();
  });

  it('resolves the system theme when the choice is "system"', async () => {
    stubSystemTheme(true);
    const store = useSettingsStore();

    await store.initialize(createFakeStorage({ theme: 'system' }));

    expect(store.systemTheme).toBe('dark');
    expect(store.resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    store.dispose();
  });

  it('follows system theme changes', async () => {
    const store = useSettingsStore();
    await store.initialize(createFakeStorage({ theme: 'system' }));

    expect(store.resolvedTheme).toBe('light');

    systemListener?.({ matches: true });

    expect(store.resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    store.dispose();
  });

  it('ignores the system theme when the choice is explicit', async () => {
    const store = useSettingsStore();
    await store.initialize(createFakeStorage({ theme: 'light' }));

    systemListener?.({ matches: true });

    expect(store.systemTheme).toBe('dark');
    expect(store.resolvedTheme).toBe('light');

    store.dispose();
  });

  it('stops listening to the system after dispose', async () => {
    const store = useSettingsStore();
    await store.initialize(createFakeStorage({ theme: 'system' }));

    store.dispose();

    expect(() => store.dispose()).not.toThrow();
  });
});
