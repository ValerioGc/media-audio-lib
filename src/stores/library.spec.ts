import { setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestPinia } from '../../tests/support/mount';
import { makeTrack } from '../../tests/support/tracks';
import * as api from '@/services/library-api';
import { ShellUnavailableError } from '@/services/library-api';
import type { AddReport } from '@/types/library';

import { useLibraryStore } from './library';

vi.mock('@/services/library-api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>();

  return {
    ...actual,
    libraryInfo: vi.fn(),
    renameLibrary: vi.fn(),
    listTracks: vi.fn(),
    addTracks: vi.fn(),
    removeTrack: vi.fn(),
    verifyTrackFile: vi.fn(),
    getCover: vi.fn(),
    pickAudioFiles: vi.fn(),
    writeMetadata: vi.fn(),
    writeCover: vi.fn(),
  };
});

const libraryInfo = vi.mocked(api.libraryInfo);
const renameLibrary = vi.mocked(api.renameLibrary);
const listTracks = vi.mocked(api.listTracks);
const addTracks = vi.mocked(api.addTracks);
const removeTrack = vi.mocked(api.removeTrack);
const verifyTrackFile = vi.mocked(api.verifyTrackFile);
const getCover = vi.mocked(api.getCover);
const pickAudioFiles = vi.mocked(api.pickAudioFiles);
const writeMetadata = vi.mocked(api.writeMetadata);
const writeCover = vi.mocked(api.writeCover);

const emptyReport: AddReport = { added: [], duplicates: [], failed: [] };

beforeEach(() => {
  setActivePinia(createTestPinia());
  libraryInfo.mockResolvedValue({ name: 'Media Audio Lib' });
  renameLibrary.mockResolvedValue({ name: 'Archivio' });
  listTracks.mockResolvedValue([]);
  addTracks.mockResolvedValue(emptyReport);
  removeTrack.mockResolvedValue(true);
  verifyTrackFile.mockImplementation(async (id: string) => makeTrack({ id }));
  getCover.mockResolvedValue(null);
  pickAudioFiles.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('caricamento', () => {
  it('parte vuoto e senza errori', () => {
    const store = useLibraryStore();

    expect(store.isEmpty).toBe(true);
    expect(store.errorKey).toBeNull();
  });

  it('carica i brani dal backend', async () => {
    const store = useLibraryStore();
    listTracks.mockResolvedValue([makeTrack(), makeTrack()]);

    await store.load();

    expect(store.tracks).toHaveLength(2);
    expect(store.isLoading).toBe(false);
  });

  it('carica il nome della libreria dal backend', async () => {
    const store = useLibraryStore();
    libraryInfo.mockResolvedValue({ name: 'Archivio jazz' });

    await store.load();

    expect(store.libraryName).toBe('Archivio jazz');
  });

  it('segnala l assenza della shell desktop', async () => {
    const store = useLibraryStore();
    listTracks.mockRejectedValue(new ShellUnavailableError());

    await store.load();

    expect(store.errorKey).toBe('shellUnavailable');
  });

  it('segnala un errore generico', async () => {
    const store = useLibraryStore();
    listTracks.mockRejectedValue(new Error('boom'));

    await store.load();

    expect(store.errorKey).toBe('generic');
  });
});

describe('rinomina', () => {
  it('salva il nome ripulito dagli spazi', async () => {
    const store = useLibraryStore();

    await expect(store.renameLibrary('  Archivio  ')).resolves.toBe(true);

    expect(renameLibrary).toHaveBeenCalledWith('Archivio');
    expect(store.libraryName).toBe('Archivio');
    expect(store.isRenaming).toBe(false);
  });

  it('rifiuta un nome vuoto senza chiamare il backend', async () => {
    const store = useLibraryStore();

    await expect(store.renameLibrary('   ')).resolves.toBe(false);

    expect(renameLibrary).not.toHaveBeenCalled();
    expect(store.errorKey).toBe('invalidLibraryName');
  });

  it('mantiene il nome corrente se il backend fallisce', async () => {
    const store = useLibraryStore();
    store.libraryName = 'Archivio';
    renameLibrary.mockRejectedValue(new Error('boom'));

    await expect(store.renameLibrary('Nuovo')).resolves.toBe(false);

    expect(store.libraryName).toBe('Archivio');
    expect(store.errorKey).toBe('generic');
  });
});

describe('importazione', () => {
  it('non chiama il backend senza percorsi', async () => {
    const store = useLibraryStore();

    await expect(store.addPaths([])).resolves.toBeNull();
    expect(addTracks).not.toHaveBeenCalled();
  });

  it('importa e ricarica la lista', async () => {
    const store = useLibraryStore();
    const added = makeTrack();
    addTracks.mockResolvedValue({ added: [added], duplicates: [], failed: [] });
    listTracks.mockResolvedValue([{ ...added, missing: false }]);

    const report = await store.addPaths([added.path]);

    expect(report?.added).toHaveLength(1);
    expect(store.tracks).toHaveLength(1);
    expect(store.isImporting).toBe(false);
  });

  it('conserva l esito con duplicati e scarti', async () => {
    const store = useLibraryStore();
    addTracks.mockResolvedValue({
      added: [],
      duplicates: ['C:/musica/gia-presente.mp3'],
      failed: [{ path: 'C:/musica/rotto.mp3', reason: 'file audio illeggibile' }],
    });

    await store.addPaths(['C:/musica/gia-presente.mp3', 'C:/musica/rotto.mp3']);

    expect(store.lastReport?.duplicates).toHaveLength(1);
    expect(store.lastReport?.failed).toHaveLength(1);

    store.dismissReport();
    expect(store.lastReport).toBeNull();
  });

  it('registra l errore di importazione', async () => {
    const store = useLibraryStore();
    addTracks.mockRejectedValue(new Error('boom'));

    await expect(store.addPaths(['a.mp3'])).resolves.toBeNull();
    expect(store.errorKey).toBe('generic');
    expect(store.isImporting).toBe(false);
  });

  it('importa i file scelti dal dialog di sistema', async () => {
    const store = useLibraryStore();
    pickAudioFiles.mockResolvedValue(['C:/musica/brano.mp3']);

    await store.pickAndAdd();

    expect(addTracks).toHaveBeenCalledWith(['C:/musica/brano.mp3']);
  });

  it('non fa nulla se il dialog viene annullato', async () => {
    const store = useLibraryStore();

    await expect(store.pickAndAdd()).resolves.toBeNull();
    expect(addTracks).not.toHaveBeenCalled();
  });

  it('segnala il dialog non disponibile fuori dalla shell', async () => {
    const store = useLibraryStore();
    pickAudioFiles.mockRejectedValue(new ShellUnavailableError());

    await store.pickAndAdd();

    expect(store.errorKey).toBe('shellUnavailable');
  });
});

describe('rimozione', () => {
  it('toglie il brano dalla lista senza ricaricare tutto', async () => {
    const store = useLibraryStore();
    const [first, second] = [makeTrack(), makeTrack()];
    listTracks.mockResolvedValue([first, second]);
    await store.load();

    store.select(first.id);
    await store.remove(first.id);

    expect(store.tracks.map((track) => track.id)).toEqual([second.id]);
    expect(store.selectedId).toBeNull();
    expect(removeTrack).toHaveBeenCalledWith(first.id);
  });

  it('mantiene la lista se il backend fallisce', async () => {
    const store = useLibraryStore();
    const track = makeTrack();
    listTracks.mockResolvedValue([track]);
    await store.load();
    removeTrack.mockRejectedValue(new Error('boom'));

    await store.remove(track.id);

    expect(store.tracks).toHaveLength(1);
    expect(store.errorKey).toBe('generic');
  });
});

describe('verifica collegamento', () => {
  it('aggiorna lo stato su disco del brano verificato', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ missing: false });
    listTracks.mockResolvedValue([track]);
    await store.load();
    verifyTrackFile.mockResolvedValue({ ...track, missing: true });

    const verified = await store.verifyTrack(track);

    expect(verifyTrackFile).toHaveBeenCalledWith(track.id);
    expect(verified?.missing).toBe(true);
    expect(store.tracks[0]?.missing).toBe(true);
  });

  it('segnala l errore senza cambiare la lista', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ missing: false });
    listTracks.mockResolvedValue([track]);
    await store.load();
    verifyTrackFile.mockRejectedValue(new Error('boom'));

    await expect(store.verifyTrack(track)).resolves.toBeNull();

    expect(store.tracks[0]?.missing).toBe(false);
    expect(store.errorKey).toBe('generic');
  });
});

describe('ricerca e ordinamento', () => {
  it('filtra la lista visibile', async () => {
    const store = useLibraryStore();
    listTracks.mockResolvedValue([makeTrack({ title: 'Alfa' }), makeTrack({ title: 'Beta' })]);
    await store.load();

    store.setQuery('alf');

    expect(store.visibleTracks.map((track) => track.title)).toEqual(['Alfa']);
    expect(store.hasNoMatches).toBe(false);

    store.setQuery('nessuno');
    expect(store.hasNoMatches).toBe(true);
  });

  it('inverte la direzione ricliccando la stessa colonna', () => {
    const store = useLibraryStore();

    store.toggleSort('title');
    expect(store.sort).toEqual({ column: 'title', direction: 'desc' });

    store.toggleSort('title');
    expect(store.sort).toEqual({ column: 'title', direction: 'asc' });
  });

  it('riparte da ascendente cambiando colonna', () => {
    const store = useLibraryStore();
    store.toggleSort('title');

    store.toggleSort('album');

    expect(store.sort).toEqual({ column: 'album', direction: 'asc' });
  });

  it('conta i file non piu presenti su disco', async () => {
    const store = useLibraryStore();
    listTracks.mockResolvedValue([makeTrack({ missing: true }), makeTrack()]);

    await store.load();

    expect(store.missingCount).toBe(1);
  });
});

describe('modifica dei metadati', () => {
  it('rimpiazza il brano modificato conservando lo stato su disco', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ title: 'Vecchio', missing: true });
    listTracks.mockResolvedValue([track]);
    await store.load();

    const { missing: _missing, ...saved } = { ...track, title: 'Nuovo' };
    writeMetadata.mockResolvedValue(saved);

    const result = await store.saveMetadata(track.id, {
      title: 'Nuovo',
      artist: null,
      album: null,
      year: null,
      genre: null,
    });

    expect(result?.title).toBe('Nuovo');
    expect(store.tracks[0]?.title).toBe('Nuovo');
    expect(store.tracks[0]?.missing).toBe(true);
    expect(store.isSaving).toBe(false);
  });

  it('invalida la copertina in cache dopo una modifica', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ hasCover: true });
    listTracks.mockResolvedValue([track]);
    await store.load();
    getCover.mockResolvedValue({ mimeType: 'image/png', data: 'AAA' });
    await store.loadCover(track);
    expect(store.covers.get(track.id)).toBeDefined();

    const { missing: _missing, ...saved } = track;
    writeCover.mockResolvedValue(saved);
    await store.saveCover(track.id, { mimeType: 'image/png', data: 'BBB' });

    expect(store.covers.get(track.id)).toBeUndefined();
  });

  it('segnala l errore di scrittura senza modificare la lista', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ title: 'Intatto' });
    listTracks.mockResolvedValue([track]);
    await store.load();
    writeMetadata.mockRejectedValue(new Error('sola lettura'));

    const result = await store.saveMetadata(track.id, {
      title: 'Nuovo',
      artist: null,
      album: null,
      year: null,
      genre: null,
    });

    expect(result).toBeNull();
    expect(store.errorKey).toBe('generic');
    expect(store.tracks[0]?.title).toBe('Intatto');
    expect(store.isSaving).toBe(false);
  });

  it('apre e chiude l editor sul brano scelto', async () => {
    const store = useLibraryStore();
    const track = makeTrack();
    listTracks.mockResolvedValue([track]);
    await store.load();

    expect(store.editingTrack).toBeNull();

    store.openEditor(track.id);
    expect(store.editingTrack?.id).toBe(track.id);

    store.closeEditor();
    expect(store.editingTrack).toBeNull();
  });
});

describe('copertine', () => {
  it('non chiede la copertina se il brano non ne ha', async () => {
    const store = useLibraryStore();

    await expect(store.loadCover(makeTrack({ hasCover: false }))).resolves.toBeNull();
    expect(getCover).not.toHaveBeenCalled();
  });

  it('non chiede la copertina di un file mancante', async () => {
    const store = useLibraryStore();

    await expect(store.loadCover(makeTrack({ hasCover: true, missing: true }))).resolves.toBeNull();
    expect(getCover).not.toHaveBeenCalled();
  });

  it('scarica la copertina una sola volta per brano', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ hasCover: true });
    getCover.mockResolvedValue({ mimeType: 'image/png', data: 'AAA' });

    const first = await store.loadCover(track);
    const second = await store.loadCover(track);

    expect(first).toBe('data:image/png;base64,AAA');
    expect(second).toBe(first);
    expect(getCover).toHaveBeenCalledTimes(1);
  });

  it('resta senza immagine se la lettura fallisce', async () => {
    const store = useLibraryStore();
    getCover.mockRejectedValue(new Error('boom'));

    await expect(store.loadCover(makeTrack({ hasCover: true }))).resolves.toBeNull();
    expect(store.errorKey).toBeNull();
  });

  it('gestisce un brano senza immagine incorporata', async () => {
    const store = useLibraryStore();
    getCover.mockResolvedValue(null);

    await expect(store.loadCover(makeTrack({ hasCover: true }))).resolves.toBeNull();
  });
});
