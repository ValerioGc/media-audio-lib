import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open, save: mocks.save }));

import {
  ShellUnavailableError,
  addTracks,
  createLibrary,
  deleteLibrary,
  exportLibrary,
  listLibraries,
  pickExportFile,
  switchLibrary,
  coverDataUrl,
  getCover,
  libraryInfo,
  listTracks,
  pickAudioFiles,
  removeTrack,
  renameLibrary,
  verifyTrackFile,
  writeCover,
  writeMetadata,
} from './library-api';

const update = { title: 'Titolo', artist: 'Autore', album: null, year: 1999, genre: 'Rock' };

const scopedWindow = window as unknown as Record<string, unknown>;

function withShell() {
  scopedWindow.__TAURI_INTERNALS__ = {};
}

beforeEach(() => {
  mocks.invoke.mockResolvedValue([]);
  mocks.open.mockResolvedValue(null);
  mocks.save.mockResolvedValue(null);
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

describe('libraryInfo', () => {
  it('usa il nome dell app fuori dalla shell', async () => {
    await expect(libraryInfo()).resolves.toEqual({ name: 'Media Audio Lib' });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('interroga il comando Rust dentro la shell', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ name: 'Archivio' });

    await expect(libraryInfo()).resolves.toEqual({ name: 'Archivio' });
    expect(mocks.invoke).toHaveBeenCalledWith('library_info');
  });
});

describe('comandi che richiedono la shell', () => {
  it('rifiutano fuori dalla shell', async () => {
    await expect(addTracks(['a.mp3'])).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(removeTrack('id')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(renameLibrary('Archivio')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(verifyTrackFile('id')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(getCover('a.mp3')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(pickAudioFiles()).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(writeMetadata('id', update)).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(writeCover('id', null)).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(createLibrary('Jazz')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(switchLibrary('lib-1')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(deleteLibrary('lib-1')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(exportLibrary('lib-1', 'copia.json')).rejects.toBeInstanceOf(
      ShellUnavailableError,
    );
    await expect(pickExportFile('Jazz')).rejects.toBeInstanceOf(ShellUnavailableError);
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

  it('inoltra il nome della libreria', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ name: 'Archivio' });

    await expect(renameLibrary('Archivio')).resolves.toEqual({ name: 'Archivio' });
    expect(mocks.invoke).toHaveBeenCalledWith('rename_library', { name: 'Archivio' });
  });

  it('inoltra la verifica del file tracciato', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ id: 'abc', missing: true });

    await expect(verifyTrackFile('abc')).resolves.toEqual({ id: 'abc', missing: true });
    expect(mocks.invoke).toHaveBeenCalledWith('verify_track_file', { id: 'abc' });
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

describe('catalogo delle librerie', () => {
  it('senza shell non conosce nessuna libreria', async () => {
    await expect(listLibraries()).resolves.toEqual([]);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('inoltra elenco, creazione, apertura ed eliminazione', async () => {
    withShell();
    mocks.invoke.mockResolvedValue([]);

    await listLibraries();
    await createLibrary('Jazz');
    await switchLibrary('lib-2');
    await deleteLibrary('lib-2');

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'list_libraries');
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'create_library', { name: 'Jazz' });
    expect(mocks.invoke).toHaveBeenNthCalledWith(3, 'switch_library', { id: 'lib-2' });
    expect(mocks.invoke).toHaveBeenNthCalledWith(4, 'delete_library', { id: 'lib-2' });
  });

  it('esporta verso il file scelto', async () => {
    withShell();
    mocks.invoke.mockResolvedValue('C:/backup/jazz.json');

    await expect(exportLibrary('lib-2', 'C:/backup/jazz.json')).resolves.toBe(
      'C:/backup/jazz.json',
    );
    expect(mocks.invoke).toHaveBeenCalledWith('export_library', {
      id: 'lib-2',
      destination: 'C:/backup/jazz.json',
    });
  });

  it('propone un nome file e filtra il dialog sul JSON', async () => {
    withShell();
    mocks.save.mockResolvedValue('C:/backup/jazz.json');

    await expect(pickExportFile('Jazz')).resolves.toBe('C:/backup/jazz.json');
    expect(mocks.save).toHaveBeenCalledWith({
      defaultPath: 'Jazz.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
  });
});
