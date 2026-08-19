import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { useTrackFileVerification } from '@/composables/useTrackFileVerification';
import * as api from '@/services/library-api';
import { ShellUnavailableError } from '@/services/library-api';
import { filterAndSort } from '@/services/track-sorting';
import {
  DEFAULT_SORT,
  type AddReport,
  type Cover,
  type LibraryImportReport,
  type LibraryImportStrategy,
  type MissingInfoFilter,
  type MetadataUpdate,
  type SortableColumn,
  type LibrarySummary,
  type SortState,
  type Track,
  type TrackExportField,
  type TrackExportFormat,
  type TrackListVerificationReport,
  type TrackView,
} from '@/types/library';

/** i18n key describing the last failure, so the UI stays free of hardcoded text. */
export type LibraryErrorKey = 'shellUnavailable' | 'generic' | 'invalidLibraryName' | null;

function errorKeyOf(error: unknown): Exclude<LibraryErrorKey, null> {
  return error instanceof ShellUnavailableError ? 'shellUnavailable' : 'generic';
}

function hasMissingInfo(track: TrackView, filter: MissingInfoFilter): boolean {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'file') {
    return track.missing;
  }

  if (filter === 'cover') {
    return !track.hasCover;
  }

  const value = track[filter];

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  return value === null;
}

export const useLibraryStore = defineStore('library', () => {
  const verification = useTrackFileVerification();
  const libraryName = ref('');
  const libraries = ref<LibrarySummary[]>([]);
  const lastExport = ref<string | null>(null);
  const lastLibraryImport = ref<LibraryImportReport | null>(null);
  const lastVerification = ref<TrackListVerificationReport | null>(null);
  const tracks = ref<TrackView[]>([]);
  const query = ref('');
  const missingInfoFilter = ref<MissingInfoFilter>('all');
  const sort = ref<SortState>({ ...DEFAULT_SORT });
  const selectedId = ref<string | null>(null);
  const editingId = ref<string | null>(null);
  const isLoading = ref(false);
  const isImporting = ref(false);
  const isLibraryImporting = ref(false);
  const isVerifying = ref(false);
  const isRenaming = ref(false);
  const isSaving = ref(false);
  const lastReport = ref<AddReport | null>(null);
  const errorKey = ref<LibraryErrorKey>(null);
  const covers = ref(new Map<string, string>());

  const tracksMatchingMissingInfo = computed(() =>
    tracks.value.filter((track) => hasMissingInfo(track, missingInfoFilter.value)),
  );
  const visibleTracks = computed(() =>
    filterAndSort(tracksMatchingMissingInfo.value, query.value, sort.value),
  );
  const editingTrack = computed(
    () => tracks.value.find((track) => track.id === editingId.value) ?? null,
  );
  const isEmpty = computed(() => tracks.value.length === 0);
  const activeLibraryId = computed(
    () => libraries.value.find((library) => library.active)?.id ?? null,
  );
  /** The catalog always keeps one library: below two, deleting is not an option. */
  const canDeleteLibrary = computed(() => libraries.value.length > 1);
  const hasNoMatches = computed(() => !isEmpty.value && visibleTracks.value.length === 0);
  const missingCount = computed(() => tracks.value.filter((track) => track.missing).length);

  function fail(error: unknown) {
    errorKey.value = errorKeyOf(error);
  }

  async function loadInfo() {
    errorKey.value = null;

    try {
      libraryName.value = (await api.libraryInfo()).name;
    } catch (error) {
      fail(error);
    }
  }

  async function load() {
    isLoading.value = true;
    errorKey.value = null;

    try {
      const [info, loadedTracks] = await Promise.all([api.libraryInfo(), api.listTracks()]);
      libraryName.value = info.name;
      tracks.value = loadedTracks;
    } catch (error) {
      fail(error);
    } finally {
      isLoading.value = false;
    }
  }

  async function renameLibrary(name: string): Promise<boolean> {
    const cleaned = name.trim();

    if (cleaned.length === 0) {
      errorKey.value = 'invalidLibraryName';
      return false;
    }

    isRenaming.value = true;
    errorKey.value = null;

    try {
      const info = await api.renameLibrary(cleaned);
      libraryName.value = info.name;
      await loadLibraries();
      return true;
    } catch (error) {
      fail(error);
      return false;
    } finally {
      isRenaming.value = false;
    }
  }

  async function loadLibraries() {
    try {
      libraries.value = await api.listLibraries();
    } catch (error) {
      fail(error);
    }
  }

  async function createLibrary(name: string): Promise<boolean> {
    const cleaned = name.trim();

    if (cleaned.length === 0) {
      errorKey.value = 'invalidLibraryName';
      return false;
    }

    errorKey.value = null;

    try {
      await api.createLibrary(cleaned);
      await loadLibraries();

      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  /** Opens another library: name, tracks and covers all belong to the new one. */
  async function switchLibrary(id: string): Promise<boolean> {
    if (id === activeLibraryId.value) {
      return true;
    }

    errorKey.value = null;

    try {
      await api.switchLibrary(id);
      selectedId.value = null;
      editingId.value = null;
      lastReport.value = null;
      covers.value = new Map();
      await load();
      await loadLibraries();

      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  /** Deletes a library; when it was the open one the backend opens another. */
  async function deleteLibrary(id: string): Promise<boolean> {
    errorKey.value = null;

    try {
      const wasActive = id === activeLibraryId.value;
      libraries.value = await api.deleteLibrary(id);

      if (wasActive) {
        covers.value = new Map();
        selectedId.value = null;
        editingId.value = null;
        await load();
      }

      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  /** Asks where to save and writes the copy; returns false when the user cancels. */
  async function exportLibrary(id: string): Promise<boolean> {
    errorKey.value = null;
    lastExport.value = null;

    const name = libraries.value.find((library) => library.id === id)?.name ?? libraryName.value;

    try {
      const destination = await api.pickExportFile(name);

      if (destination === null) {
        return false;
      }

      lastExport.value = await api.exportLibrary(id, destination);

      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  async function exportTrackList(
    format: TrackExportFormat,
    fields: readonly TrackExportField[],
  ): Promise<boolean> {
    if (fields.length === 0) {
      return false;
    }

    errorKey.value = null;
    lastExport.value = null;

    try {
      const destination = await api.pickTrackListExportFile(libraryName.value, format);

      if (destination === null) {
        return false;
      }

      lastExport.value = await api.exportTrackList(destination, format, fields);

      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  function dismissExport() {
    lastExport.value = null;
  }

  async function importLibrary(strategy: LibraryImportStrategy): Promise<boolean> {
    isLibraryImporting.value = true;
    errorKey.value = null;
    lastLibraryImport.value = null;

    try {
      const source = await api.pickImportFile();

      if (source === null) {
        return false;
      }

      lastLibraryImport.value = await api.importLibrary(source, strategy);
      await load();
      await loadLibraries();

      return true;
    } catch (error) {
      fail(error);
      return false;
    } finally {
      isLibraryImporting.value = false;
    }
  }

  function dismissLibraryImport() {
    lastLibraryImport.value = null;
  }

  /** Imports the given files and refreshes the list, keeping the import report. */
  async function addPaths(paths: readonly string[]): Promise<AddReport | null> {
    if (paths.length === 0) {
      return null;
    }

    isImporting.value = true;
    errorKey.value = null;

    try {
      const report = await api.addTracks(paths);
      lastReport.value = report;
      tracks.value = await api.listTracks();

      return report;
    } catch (error) {
      fail(error);
      return null;
    } finally {
      isImporting.value = false;
    }
  }

  async function pickAndAdd(): Promise<AddReport | null> {
    return pickThenAdd(api.pickAudioFiles);
  }

  /** Imports whole folders: the backend keeps only the audio files found inside. */
  async function pickFoldersAndAdd(): Promise<AddReport | null> {
    return pickThenAdd(api.pickFolders);
  }

  async function pickThenAdd(pick: () => Promise<string[]>): Promise<AddReport | null> {
    try {
      return await addPaths(await pick());
    } catch (error) {
      fail(error);
      return null;
    }
  }

  async function remove(id: string) {
    errorKey.value = null;

    try {
      await api.removeTrack(id);
      tracks.value = tracks.value.filter((track) => track.id !== id);
      covers.value.delete(id);

      if (selectedId.value === id) {
        selectedId.value = null;
      }
    } catch (error) {
      fail(error);
    }
  }

  /** Loads a cover once per track; the result is kept in memory for the session. */
  async function loadCover(track: TrackView): Promise<string | null> {
    if (!track.hasCover || track.missing) {
      return null;
    }

    const cached = covers.value.get(track.id);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const cover = await api.getCover(track.path);
      if (cover === null) {
        return null;
      }

      const dataUrl = api.coverDataUrl(cover);
      covers.value = new Map(covers.value).set(track.id, dataUrl);

      return dataUrl;
    } catch {
      return null;
    }
  }

  /** Replaces a track after an edit, keeping the on-disk state already known. */
  function replaceTrack(updated: Track) {
    tracks.value = tracks.value.map((track) =>
      track.id === updated.id ? { ...updated, missing: track.missing } : track,
    );

    const covers_ = new Map(covers.value);
    covers_.delete(updated.id);
    covers.value = covers_;
  }

  function replaceTrackView(updated: TrackView) {
    tracks.value = tracks.value.map((track) => (track.id === updated.id ? updated : track));
  }

  async function verifyTrack(track: TrackView): Promise<TrackView | null> {
    errorKey.value = null;

    try {
      const verified = await verification.verify(track);
      replaceTrackView(verified);

      return verified;
    } catch (error) {
      fail(error);
      return null;
    }
  }

  async function verifyAllTracks(): Promise<TrackListVerificationReport | null> {
    isVerifying.value = true;
    errorKey.value = null;
    lastVerification.value = null;

    try {
      const verified: TrackView[] = [];

      for (const track of tracks.value) {
        verified.push(await verification.verify(track));
      }

      tracks.value = tracks.value.map(
        (track) => verified.find((entry) => entry.id === track.id) ?? track,
      );

      lastVerification.value = {
        total: verified.length,
        missing: verified.filter((track) => track.missing).length,
      };

      return lastVerification.value;
    } catch (error) {
      fail(error);
      return null;
    } finally {
      isVerifying.value = false;
    }
  }

  async function withSaving<T>(action: () => Promise<T>): Promise<T | null> {
    isSaving.value = true;
    errorKey.value = null;

    try {
      return await action();
    } catch (error) {
      fail(error);
      return null;
    } finally {
      isSaving.value = false;
    }
  }

  async function saveMetadata(id: string, update: MetadataUpdate): Promise<Track | null> {
    return withSaving(async () => {
      const updated = await api.writeMetadata(id, update);
      replaceTrack(updated);

      return updated;
    });
  }

  async function saveCover(id: string, cover: Cover | null): Promise<Track | null> {
    return withSaving(async () => {
      const updated = await api.writeCover(id, cover);
      replaceTrack(updated);

      return updated;
    });
  }

  function openEditor(id: string) {
    editingId.value = id;
    errorKey.value = null;
  }

  function closeEditor() {
    editingId.value = null;
  }

  function setQuery(value: string) {
    query.value = value;
  }

  function setMissingInfoFilter(value: MissingInfoFilter) {
    missingInfoFilter.value = value;
  }

  /** Sorts by the given column, flipping the direction when it is already active. */
  function toggleSort(column: SortableColumn) {
    if (sort.value.column === column) {
      sort.value = {
        column,
        direction: sort.value.direction === 'asc' ? 'desc' : 'asc',
      };
      return;
    }

    sort.value = { column, direction: 'asc' };
  }

  function select(id: string | null) {
    selectedId.value = id;
  }

  function dismissReport() {
    lastReport.value = null;
  }

  function dismissVerification() {
    lastVerification.value = null;
  }

  return {
    tracks,
    query,
    sort,
    selectedId,
    editingId,
    isLoading,
    isImporting,
    isLibraryImporting,
    isVerifying,
    isRenaming,
    isSaving,
    libraryName,
    libraries,
    lastExport,
    lastLibraryImport,
    lastVerification,
    lastReport,
    errorKey,
    covers,
    visibleTracks,
    tracksMatchingMissingInfo,
    editingTrack,
    isEmpty,
    activeLibraryId,
    canDeleteLibrary,
    hasNoMatches,
    missingCount,
    loadInfo,
    load,
    renameLibrary,
    loadLibraries,
    createLibrary,
    switchLibrary,
    deleteLibrary,
    exportLibrary,
    exportTrackList,
    dismissExport,
    importLibrary,
    dismissLibraryImport,
    addPaths,
    pickAndAdd,
    pickFoldersAndAdd,
    remove,
    verifyTrack,
    verifyAllTracks,
    loadCover,
    saveMetadata,
    saveCover,
    openEditor,
    closeEditor,
    setQuery,
    missingInfoFilter,
    setMissingInfoFilter,
    toggleSort,
    select,
    dismissReport,
    dismissVerification,
  };
});
