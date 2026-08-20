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
import { makeTrack } from '../../tests/support/tracks';

import { playbackUrl, startupAudioFile } from './playback-api';

const scopedWindow = window as unknown as Record<string, unknown>;

beforeEach(() => {
  mocks.invoke.mockResolvedValue('C:/music/track.mp3');
  mocks.convertFileSrc.mockReturnValue('asset://localhost/C%3A%2Fmusica%2Ftrack.mp3');
});

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('playbackUrl', () => {
  it('chiede al backend il permesso sul file e converte il path', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};

    const url = await playbackUrl(makeTrack({ id: 'id-1' }));

    expect(mocks.invoke).toHaveBeenCalledWith('prepare_playback', { id: 'id-1' });
    expect(mocks.convertFileSrc).toHaveBeenCalledWith('C:/music/track.mp3');
    expect(url).toBe('asset://localhost/C%3A%2Fmusica%2Ftrack.mp3');
  });

  it('outside the shell it does not even try to play', async () => {
    await expect(playbackUrl(makeTrack({ id: 'id-1' }))).rejects.toBeInstanceOf(
      ShellUnavailableError,
    );
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('prepares standalone files by path', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};

    await playbackUrl(makeTrack({ path: 'C:/music/direct.mp3', standalone: true }));

    expect(mocks.invoke).toHaveBeenCalledWith('prepare_external_playback', {
      path: 'C:/music/direct.mp3',
    });
  });

  it('loads the audio file passed when the app starts', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    mocks.invoke.mockResolvedValue(makeTrack({ id: 'direct' }));

    const track = await startupAudioFile();

    expect(mocks.invoke).toHaveBeenCalledWith('startup_audio_file');
    expect(track?.standalone).toBe(true);
  });

  it('ignores startup files outside the shell', async () => {
    await expect(startupAudioFile()).resolves.toBeNull();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('ignores unreadable startup files', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.invoke.mockRejectedValue(new Error('broken audio'));

    await expect(startupAudioFile()).resolves.toBeNull();
  });
});
