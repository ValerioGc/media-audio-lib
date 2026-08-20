import { describe, expect, it } from 'vitest';

import {
  APP_NAME,
  APP_VERSION,
  SUPPORTED_EXTENSIONS,
  fileExtension,
  isSupportedAudioFile,
  isTauriRuntime,
} from './app-config';

describe('app-config', () => {
  it('exposes the app name and version', () => {
    expect(APP_NAME).toBe('Media Audio Lib');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('includes mp3 among supported formats', () => {
    expect(SUPPORTED_EXTENSIONS).toContain('mp3');
  });

  describe('fileExtension', () => {
    it.each([
      ['C:\\Musica\\track.MP3', 'mp3'],
      ['/home/utente/track.flac', 'flac'],
      ['track.tar.ogg', 'ogg'],
      ['senza-estensione', ''],
      ['finisce-con-punto.', ''],
      ['.nascosto', ''],
      ['', ''],
    ])('estrae l estensione da %s', (path, expected) => {
      expect(fileExtension(path)).toBe(expected);
    });
  });

  describe('isSupportedAudioFile', () => {
    it('accepts supported formats regardless of case', () => {
      expect(isSupportedAudioFile('C:\\Musica\\track.Mp3')).toBe(true);
      expect(isSupportedAudioFile('/musica/track.wav')).toBe(true);
    });

    it('rejects unsupported formats', () => {
      expect(isSupportedAudioFile('/musica/cover.png')).toBe(false);
      expect(isSupportedAudioFile('/musica/track')).toBe(false);
    });
  });

  describe('isTauriRuntime', () => {
    it('is false in the test browser', () => {
      expect(isTauriRuntime()).toBe(false);
    });

    it('is true when the Tauri shell injected its runtime', () => {
      const scopedWindow = window as unknown as Record<string, unknown>;
      scopedWindow.__TAURI_INTERNALS__ = {};

      try {
        expect(isTauriRuntime()).toBe(true);
      } finally {
        delete scopedWindow.__TAURI_INTERNALS__;
      }
    });
  });
});
