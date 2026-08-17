import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSystemTheme, watchSystemTheme } from './system-theme';

interface FakeQuery {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

const originalMatchMedia = window.matchMedia;

function stubMatchMedia(query: FakeQuery | null) {
  window.matchMedia = (query === null
    ? undefined
    : () => query) as unknown as typeof window.matchMedia;
}

function createFakeQuery(matches: boolean): FakeQuery {
  return { matches, addEventListener: vi.fn(), removeEventListener: vi.fn() };
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('system-theme', () => {
  it('riporta il tema scuro quando il sistema lo preferisce', () => {
    stubMatchMedia(createFakeQuery(true));

    expect(getSystemTheme()).toBe('dark');
  });

  it('riporta il tema chiaro come impostazione predefinita', () => {
    stubMatchMedia(createFakeQuery(false));

    expect(getSystemTheme()).toBe('light');
  });

  it('riporta il tema chiaro quando matchMedia non e disponibile', () => {
    stubMatchMedia(null);

    expect(getSystemTheme()).toBe('light');
  });

  it('notifica i cambi di tema di sistema', () => {
    const query = createFakeQuery(false);
    stubMatchMedia(query);
    const onChange = vi.fn();

    watchSystemTheme(onChange);
    const listener = query.addEventListener.mock.calls[0]?.[1] as (event: {
      matches: boolean;
    }) => void;
    listener({ matches: true });

    expect(onChange).toHaveBeenCalledWith('dark');

    listener({ matches: false });
    expect(onChange).toHaveBeenLastCalledWith('light');
  });

  it('rimuove il listener quando si annulla la sottoscrizione', () => {
    const query = createFakeQuery(false);
    stubMatchMedia(query);

    const unsubscribe = watchSystemTheme(vi.fn());
    unsubscribe();

    expect(query.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('restituisce una funzione inerte quando matchMedia non e disponibile', () => {
    stubMatchMedia(null);

    const unsubscribe = watchSystemTheme(vi.fn());

    expect(() => unsubscribe()).not.toThrow();
  });
});
