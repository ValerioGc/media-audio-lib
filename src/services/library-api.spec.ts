import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }));

import {
  ShellUnavailableError,
  addTracks,
  coverDataUrl,
  getCover,
  listTracks,
  pickAudioFiles,
  removeTrack,
  writeCover,
  writeMetadata,
} from './library-api';

const update = { title: 'Titolo', album: null, year: 1999, genre: 'Rock' };

const scopedWindow = window as unknown as Record<string, unknown>;

function withShell() {
  scopedWindow.__TAURI_INTERNALS__ = {};
}

beforeEach(() => {
  mocks.invoke.mockResolvedValue([]);
  mocks.open.mockResolvedValue(null);
});

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

describe('listTracks', () => {
  it('restituisce una lista vuota fuori dalla shell', async () => {
    await expect(listTracks()).resolves.toEqual([]);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('interroga il comando Rust dentro la shell', async () => {
    withShell();
    mocks.invoke.mockResolvedValue([{ id: 'a' }]);

    await expect(listTracks()).resolves.toEqual([{ id: 'a' }]);
    expect(mocks.invoke).toHaveBeenCalledWith('list_tracks');
  });
});

describe('comandi che richiedono la shell', () => {
  it('rifiutano fuori dalla shell', async () => {
    await expect(addTracks(['a.mp3'])).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(removeTrack('id')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(getCover('a.mp3')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(pickAudioFiles()).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(writeMetadata('id', update)).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(writeCover('id', null)).rejects.toBeInstanceOf(ShellUnavailableError);
  });

  it('inoltra la modifica dei metadati', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ id: 'abc', title: 'Titolo' });

    await expect(writeMetadata('abc', update)).resolves.toEqual({ id: 'abc', title: 'Titolo' });
    expect(mocks.invoke).toHaveBeenCalledWith('write_metadata', { id: 'abc', update });
  });

  it('inoltra la scrittura e la rimozione della copertina', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ id: 'abc' });
    const cover = { mimeType: 'image/png', data: 'AAA' };

    await writeCover('abc', cover);
    expect(mocks.invoke).toHaveBeenCalledWith('write_cover', { id: 'abc', cover });

    await writeCover('abc', null);
    expect(mocks.invoke).toHaveBeenLastCalledWith('write_cover', { id: 'abc', cover: null });
  });

  it('inoltra i percorsi al comando di import', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ added: [], duplicates: [], failed: [] });

    await addTracks(['C:/musica/brano.mp3']);

    expect(mocks.invoke).toHaveBeenCalledWith('add_tracks', {
      paths: ['C:/musica/brano.mp3'],
    });
  });

  it('inoltra l identificativo alla rimozione', async () => {
    withShell();
    mocks.invoke.mockResolvedValue(true);

    await expect(removeTrack('abc')).resolves.toBe(true);
    expect(mocks.invoke).toHaveBeenCalledWith('remove_track', { id: 'abc' });
  });

  it('richiede la copertina per percorso', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ mimeType: 'image/png', data: 'AAA' });

    await expect(getCover('C:/musica/brano.mp3')).resolves.toEqual({
      mimeType: 'image/png',
      data: 'AAA',
    });
  });
});

describe('pickAudioFiles', () => {
  beforeEach(withShell);

  it('restituisce una lista vuota quando l utente annulla', async () => {
    mocks.open.mockResolvedValue(null);

    await expect(pickAudioFiles()).resolves.toEqual([]);
  });

  it('normalizza una selezione singola in una lista', async () => {
    mocks.open.mockResolvedValue('C:/musica/brano.mp3');

    await expect(pickAudioFiles()).resolves.toEqual(['C:/musica/brano.mp3']);
  });

  it('restituisce la selezione multipla', async () => {
    mocks.open.mockResolvedValue(['a.mp3', 'b.flac']);

    await expect(pickAudioFiles()).resolves.toEqual(['a.mp3', 'b.flac']);
  });

  it('filtra il dialog sui formati supportati', async () => {
    await pickAudioFiles();

    expect(mocks.open).toHaveBeenCalledWith(
      expect.objectContaining({
        multiple: true,
        filters: [expect.objectContaining({ extensions: expect.arrayContaining(['mp3']) })],
      }),
    );
  });
});

describe('coverDataUrl', () => {
  it('compone una data URL utilizzabile in un tag img', () => {
    expect(coverDataUrl({ mimeType: 'image/png', data: 'AAAA' })).toBe(
      'data:image/png;base64,AAAA',
    );
  });
});
