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
  it('parte dai valori predefiniti', () => {
    const store = useSettingsStore();

    expect(store.textSize).toBe(DEFAULT_SETTINGS.textSize);
    expect(store.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(store.isReady).toBe(false);
  });

  it('ripristina le impostazioni salvate e le applica al documento', async () => {
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

  it('scarta i valori salvati non validi', async () => {
    const store = useSettingsStore();

    await store.initialize(
      createFakeStorage({ textSize: 'gigante' } as unknown as Partial<AppSettings>),
    );

    expect(store.textSize).toBe(DEFAULT_SETTINGS.textSize);

    store.dispose();
  });

  it('usa la lingua del browser al primo avvio', async () => {
    const store = useSettingsStore();
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB', 'it-IT']);

    await store.initialize(createFakeStorage());

    expect(store.locale).toBe('en');

    store.dispose();
  });

  it('ricade sui valori predefiniti se la lettura fallisce', async () => {
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

  it('persiste ogni modifica', async () => {
    const store = useSettingsStore();
    const storage = createFakeStorage();
    await store.initialize(storage);

    await store.setLocale('en');
    await store.setTextSize('small');
    await store.setTheme('light');

    expect(storage.saved).toHaveLength(3);
    expect(storage.saved.at(-1)).toEqual({
      locale: 'en',
      textSize: 'small',
      theme: 'light',
      viewMode: 'table',
    });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--app_font_scale')).toBe('0.875');

    store.dispose();
  });

  it('ricorda la vista scelta per la libreria', async () => {
    const store = useSettingsStore();
    const storage = createFakeStorage();
    await store.initialize(storage);

    await store.setViewMode('preview');

    expect(store.viewMode).toBe('preview');
    expect(storage.saved.at(-1)?.viewMode).toBe('preview');

    store.dispose();
  });

  it('ripristina la vista salvata in una sessione precedente', async () => {
    const store = useSettingsStore();

    await store.initialize(createFakeStorage({ viewMode: 'preview' }));

    expect(store.viewMode).toBe('preview');

    store.dispose();
  });

  it('scarta una vista sconosciuta tornando all elenco', async () => {
    const store = useSettingsStore();

    await store.initialize(
      createFakeStorage({ viewMode: 'copertine' } as unknown as Partial<AppSettings>),
    );

    expect(store.viewMode).toBe(DEFAULT_SETTINGS.viewMode);

    store.dispose();
  });

  it('non propaga gli errori di scrittura', async () => {
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

  it('risolve il tema di sistema quando la scelta e "system"', async () => {
    stubSystemTheme(true);
    const store = useSettingsStore();

    await store.initialize(createFakeStorage({ theme: 'system' }));

    expect(store.systemTheme).toBe('dark');
    expect(store.resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    store.dispose();
  });

  it('segue i cambi di tema del sistema', async () => {
    const store = useSettingsStore();
    await store.initialize(createFakeStorage({ theme: 'system' }));

    expect(store.resolvedTheme).toBe('light');

    systemListener?.({ matches: true });

    expect(store.resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    store.dispose();
  });

  it('ignora il tema di sistema quando la scelta e esplicita', async () => {
    const store = useSettingsStore();
    await store.initialize(createFakeStorage({ theme: 'light' }));

    systemListener?.({ matches: true });

    expect(store.systemTheme).toBe('dark');
    expect(store.resolvedTheme).toBe('light');

    store.dispose();
  });

  it('smette di ascoltare il sistema dopo dispose', async () => {
    const store = useSettingsStore();
    await store.initialize(createFakeStorage({ theme: 'system' }));

    store.dispose();

    expect(() => store.dispose()).not.toThrow();
  });
});
