import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: mocks.openUrl }));

import { openDefaultAudioPlayerSettings } from './default-player';

const scopedWindow = window as unknown as Record<string, unknown>;

beforeEach(() => {
  mocks.openUrl.mockResolvedValue(undefined);
});

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

describe('openDefaultAudioPlayerSettings', () => {
  it('does nothing outside the shell', async () => {
    await expect(openDefaultAudioPlayerSettings()).resolves.toBe(false);
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });

  it('opens Windows default app settings inside the shell', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};

    await expect(openDefaultAudioPlayerSettings()).resolves.toBe(true);
    expect(mocks.openUrl).toHaveBeenCalledWith('ms-settings:defaultapps');
  });

  it('reports failures without throwing', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.openUrl.mockRejectedValue(new Error('blocked'));

    await expect(openDefaultAudioPlayerSettings()).resolves.toBe(false);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
