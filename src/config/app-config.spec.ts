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
  it('espone nome e versione dell applicazione', () => {
    expect(APP_NAME).toBe('Media Audio Lib');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('include mp3 tra i formati supportati', () => {
    expect(SUPPORTED_EXTENSIONS).toContain('mp3');
  });

  describe('fileExtension', () => {
    it.each([
      ['C:\\Musica\\brano.MP3', 'mp3'],
      ['/home/utente/brano.flac', 'flac'],
      ['brano.tar.ogg', 'ogg'],
      ['senza-estensione', ''],
      ['finisce-con-punto.', ''],
      ['.nascosto', ''],
      ['', ''],
    ])('estrae l estensione da %s', (path, expected) => {
      expect(fileExtension(path)).toBe(expected);
    });
  });

  describe('isSupportedAudioFile', () => {
    it('accetta i formati gestiti indipendentemente dal case', () => {
      expect(isSupportedAudioFile('C:\\Musica\\brano.Mp3')).toBe(true);
      expect(isSupportedAudioFile('/musica/brano.wav')).toBe(true);
    });

    it('rifiuta i formati non gestiti', () => {
      expect(isSupportedAudioFile('/musica/copertina.png')).toBe(false);
      expect(isSupportedAudioFile('/musica/brano')).toBe(false);
    });
  });

  describe('isTauriRuntime', () => {
    it('e false nel browser di test', () => {
      expect(isTauriRuntime()).toBe(false);
    });

    it('e true quando la shell Tauri ha iniettato il suo runtime', () => {
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
