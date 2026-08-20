import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  convertFileSrc: mocks.convertFileSrc,
}));

import { ShellUnavailableError } from './library-api';
import { playbackUrl } from './playback-api';

const scopedWindow = window as unknown as Record<string, unknown>;

beforeEach(() => {
  mocks.invoke.mockResolvedValue('C:/music/track.mp3');
  mocks.convertFileSrc.mockReturnValue('asset://localhost/C%3A%2Fmusica%2Ftrack.mp3');
});

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

describe('playbackUrl', () => {
  it('chiede al backend il permesso sul file e converte il path', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};

    const url = await playbackUrl('id-1');

    expect(mocks.invoke).toHaveBeenCalledWith('prepare_playback', { id: 'id-1' });
    expect(mocks.convertFileSrc).toHaveBeenCalledWith('C:/music/track.mp3');
    expect(url).toBe('asset://localhost/C%3A%2Fmusica%2Ftrack.mp3');
  });

  it('outside the shell it does not even try to play', async () => {
    await expect(playbackUrl('id-1')).rejects.toBeInstanceOf(ShellUnavailableError);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
