import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyCloseToTray,
  applyTrayLabels,
  onTrayStopPlayback,
} from '@/services/shell-integration';

afterEach(() => {
  Reflect.deleteProperty(globalThis.window, '__TAURI_INTERNALS__');
  vi.restoreAllMocks();
});

describe('shell integration outside the desktop shell', () => {
  it('does nothing, so the same settings work in the browser', async () => {
    expect(await applyCloseToTray(true)).toBe(false);
    expect(await applyTrayLabels('Apri', 'Interrompi', 'Esci')).toBe(false);
    expect(await onTrayStopPlayback(() => {})).toBeNull();
  });
});
