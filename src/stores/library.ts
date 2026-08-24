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
  type LibraryExportMode,
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
  type LibraryRefreshReport,
  type TrackListVerificationReport,
  type TrackView,
} from '@/types/library';

/** i18n key describing the last failure, so the UI stays free of hardcoded text. */
export type LibraryErrorKey =
  'shellUnavailable' | 'generic' | 'invalidLibraryName' | 'duplicateLibraryName' | null;

function errorKeyOf(error: unknown): Exclude<LibraryErrorKey, null> {
  return error instanceof ShellUnavailableError ? 'shellUnavailable' : 'generic';
}

/**
 * FNV-1a over the paths, sorted so the order they were read in does not matter.
 *
 * A hash rather than the list: it is written to the preferences file, where a library that
 * lost a whole drive would otherwise leave hundreds of paths behind. The count is kept
 * beside it, which makes the stored value readable and separates two sets of the same size
 * from two of different sizes without touching the hash.
 */
function fingerprintOf(paths: readonly string[]): string {
  let hash = 0x811c9dc5;

  for (const path of [...paths].sort()) {
    for (let index = 0; index < path.length; index += 1) {
      hash ^= path.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }

    // The separator keeps two paths from running into one another: without it `ab` and `c`
    // would hash the same as `a` and `bc`.
    hash ^= 0x1f;
    hash = Math.imul(hash, 0x01000193);
  }

  return `${paths.length}:${(hash >>> 0).toString(16)}`;
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

function uniqueTrackValues(
  tracks: readonly TrackView[],
  field: 'artist' | 'album' | 'genre',
): string[] {
  return [
    ...new Set(
      tracks.map((track) => track[field]?.trim() ?? '').filter((value) => value.length > 0),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function keepExistingIds(ids: readonly string[], tracks: readonly TrackView[]): string[] {
  const known = new Set(tracks.map((track) => track.id));

  return ids.filter((id) => known.has(id));
}

export const useLibraryStore = defineStore('library', () => {
  const verification = useTrackFileVerification();
  const libraryName = ref('');
  const libraries = ref<LibrarySummary[]>([]);
  const lastExport = ref<string | null>(null);
  const lastLibraryImport = ref<LibraryImportReport | null>(null);
  const lastVerification = ref<TrackListVerificationReport | null>(null);
  const lastRefresh = ref<LibraryRefreshReport | null>(null);
  let refreshRequest = 0;
  const tracks = ref<TrackView[]>([]);
  const query = ref('');
  const missingInfoFilter = ref<MissingInfoFilter>('all');
  const sort = ref<SortState>({ ...DEFAULT_SORT });
  const selectedIds = ref<string[]>([]);
  const editingId = ref<string | null>(null);
  const isLoading = ref(false);
  const isImporting = ref(false);
  const isLibraryImporting = ref(false);
  const isVerifying = ref(false);
  const isRenaming = ref(false);
  const isSaving = ref(false);
  const lastReport = ref<AddReport | null>(null);
  const errorKey = ref<LibraryErrorKey>(null);
  /**
   * How many times the cover of a track has been rewritten, by track id.
   *
   * The address of a cover does not change when its picture does, and the webview caches by
   * address: without this an edit would leave the old image on screen.
   */
  const coverVersions = ref(new Map<string, number>());

  /** Makes the address of a cover a new one, so what is on screen is read again. */
  function bumpCover(id: string) {
    const versions = new Map(coverVersions.value);
    versions.set(id, (versions.get(id) ?? 0) + 1);
    coverVersions.value = versions;
  }

  const tracksMatchingMissingInfo = computed(() =>
    tracks.value.filter((track) => hasMissingInfo(track, missingInfoFilter.value)),
  );
  const visibleTracks = computed(() =>
    filterAndSort(tracksMatchingMissingInfo.value, query.value, sort.value),
  );
  const selectedId = computed(() => selectedIds.value.at(-1) ?? null);
  const selectedTracks = computed(() =>
    selectedIds.value
      .map((id) => tracks.value.find((track) => track.id === id))
      .filter((track): track is TrackView => track !== undefined),
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
  const hasMissingAfterRefresh = computed(() => (lastRefresh.value?.missing.length ?? 0) > 0);

  /**
   * A short name for the set of files the last check found gone.
   *
   * The banner reporting them is closed for good rather than for the moment, so what was
   * closed has to be written down — and the list itself can run to hundreds of paths. Two
   * checks that found the same files answer with the same key, and one that found a file
   * the other did not answers with a different one, which is all the comparison needs.
   */
  const missingReportKey = computed(() =>
    hasMissingAfterRefresh.value ? fingerprintOf(lastRefresh.value?.missing ?? []) : '',
  );

  /** How many different values the library holds for a field, blanks left out. */
  function distinctCount(field: 'artist' | 'album' | 'genre'): number {
    return new Set(
      tracks.value.map((track) => track[field]?.trim() ?? '').filter((value) => value.length > 0),
    ).size;
  }

  const artistCount = computed(() => distinctCount('artist'));
  const albumCount = computed(() => distinctCount('album'));
  const genreCount = computed(() => distinctCount('genre'));
  const artistSuggestions = computed(() => uniqueTrackValues(tracks.value, 'artist'));
  const albumSuggestions = computed(() => uniqueTrackValues(tracks.value, 'album'));
  const genreSuggestions = computed(() => uniqueTrackValues(tracks.value, 'genre'));

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
      selectedIds.value = keepExistingIds(selectedIds.value, loadedTracks);
    } catch (error) {
      fail(error);
    } finally {
      isLoading.value = false;
    }

    // Opening the library does not wait for the disk: the list is on screen first, and what
    // changed outside the app arrives as soon as the files have been gone through.
    refreshFromDisk().catch((error: unknown) => {
      console.error('Library refresh failed', error);
    });
  }

  /**
   * Reads the files again, behind the list.
   *
   * A library opened while a refresh is still running makes that answer stale, so only the
   * last request is allowed to touch the state.
   */
  async function refreshFromDisk() {
    const request = ++refreshRequest;
    lastRefresh.value = null;

    try {
      const report = await api.refreshLibraryFromDisk();

      if (request !== refreshRequest) {
        return;
      }

      if (report.refreshed > 0 || report.missing.length > 0) {
        const refreshedTracks = await api.listTracks();

        if (request !== refreshRequest) {
          return;
        }

        tracks.value = refreshedTracks;
        selectedIds.value = keepExistingIds(selectedIds.value, refreshedTracks);
      }

      lastRefresh.value = report;
    } catch (error) {
      // The list on screen stays usable: a refresh that failed is not a broken library.
      console.error('Library refresh failed', error);
    }
  }

  /**
   * Brings one entry up to date with its file, and hands it back.
   *
   * Called before playing a track and before editing it: another program may have written
   * to that file since the library last looked, and both moments need the truth of it.
   */
  async function refreshTrack(id: string): Promise<TrackView | null> {
    try {
      const refreshed = await api.refreshTrack(id);

      if (refreshed === null) {
        return null;
      }

      tracks.value = tracks.value.map((track) => (track.id === id ? refreshed : track));
      // The cover may have changed with the tags: a new address makes the webview fetch it
      // again rather than show what it already has.
      bumpCover(id);

      return refreshed;
    } catch (error) {
      console.error('Track refresh failed', error);

      return tracks.value.find((track) => track.id === id) ?? null;
    }
  }

  function dismissRefresh() {
    lastRefresh.value = null;
  }

  /**
   * Whether another library already answers to this name.
   *
   * Case and the spaces around it are not what tells two libraries apart, so neither are
   * they here: "Jazz" and "jazz " in the same list are a mistake waiting to be made.
   */
  function isNameTaken(name: string, except: string | null): boolean {
    const wanted = name.trim().toLowerCase();

    return libraries.value.some(
      (library) => library.id !== except && library.name.trim().toLowerCase() === wanted,
    );
  }

  async function renameLibrary(name: string): Promise<boolean> {
    const cleaned = name.trim();

    if (cleaned.length === 0) {
      errorKey.value = 'invalidLibraryName';
      return false;
    }

    // Keeping its own name is not a clash: only the other libraries are in the way.
    if (isNameTaken(cleaned, activeLibraryId.value)) {
      errorKey.value = 'duplicateLibraryName';
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

  function canDeleteLibraryId(id: string | null): boolean {
    return id !== null && libraries.value.some((library) => library.id !== id);
  }

  async function loadHomeLibrary(mainLibraryId: string | null) {
    await loadLibraries();

    if (
      mainLibraryId !== null &&
      libraries.value.some((entry) => entry.id === mainLibraryId) &&
      activeLibraryId.value !== mainLibraryId
    ) {
      await switchLibrary(mainLibraryId);
      return;
    }

    await load();
  }

  async function createLibrary(name: string): Promise<boolean> {
    const cleaned = name.trim();

    if (cleaned.length === 0) {
      errorKey.value = 'invalidLibraryName';
      return false;
    }

    // The shell refuses this too, and has the last word — but it already knows the answer
    // here, and a name typed by hand deserves to be told at once rather than after a trip.
    if (isNameTaken(cleaned, null)) {
      errorKey.value = 'duplicateLibraryName';
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
      selectedIds.value = [];
      editingId.value = null;
      lastReport.value = null;
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
        selectedIds.value = [];
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
  async function exportLibrary(id: string, mode: LibraryExportMode = 'full'): Promise<boolean> {
    errorKey.value = null;
    lastExport.value = null;

    const name = libraries.value.find((library) => library.id === id)?.name ?? libraryName.value;

    try {
      const destination = await api.pickExportFile(name);

      if (destination === null) {
        return false;
      }

      lastExport.value = await api.exportLibrary(id, destination, mode);

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
      selectedIds.value = keepExistingIds(selectedIds.value, tracks.value);

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
      selectedIds.value = selectedIds.value.filter((selected) => selected !== id);
    } catch (error) {
      fail(error);
    }
  }

  /**
   * Where to fetch the cover of a track, or null when there is nothing to fetch.
   *
   * No call and no waiting: the address is enough, and everything after it — fetching,
   * decoding, caching, dropping what is off screen — is the webview's own business.
   */
  function coverUrl(track: TrackView): string | null {
    if (!track.hasCover || track.missing) {
      return null;
    }

    return api.coverUrl(track.path, coverVersions.value.get(track.id) ?? 0);
  }

  /** Asks why a cover is not showing. Called where the answer is worth a round trip. */
  async function heavyCoverBytes(track: TrackView): Promise<number | null> {
    try {
      return await api.heavyCoverBytes(track.path);
    } catch {
      return null;
    }
  }

  /** Replaces a track after an edit, keeping the on-disk state already known. */
  function replaceTrack(updated: Track) {
    tracks.value = tracks.value.map((track) =>
      track.id === updated.id ? { ...updated, missing: track.missing } : track,
    );

    bumpCover(updated.id);
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

  async function openEditor(id: string) {
    errorKey.value = null;
    // Another program may have written to the file since: the editor starts from the truth
    // of it, so an edit cannot quietly undo what was done outside.
    await refreshTrack(id);
    editingId.value = id;
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
    selectedIds.value = id === null ? [] : [id];
  }

  function setSelected(ids: readonly string[]) {
    selectedIds.value = keepExistingIds([...new Set(ids)], tracks.value);
  }

  function toggleSelected(id: string) {
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter((selected) => selected !== id)
      : [...selectedIds.value, id];
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
    selectedIds,
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
    visibleTracks,
    tracksMatchingMissingInfo,
    editingTrack,
    selectedTracks,
    isEmpty,
    activeLibraryId,
    canDeleteLibrary,
    hasNoMatches,
    missingCount,
    hasMissingAfterRefresh,
    missingReportKey,
    lastRefresh,
    artistCount,
    albumCount,
    genreCount,
    artistSuggestions,
    albumSuggestions,
    genreSuggestions,
    loadInfo,
    load,
    renameLibrary,
    loadLibraries,
    canDeleteLibraryId,
    loadHomeLibrary,
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
    refreshFromDisk,
    refreshTrack,
    dismissRefresh,
    verifyAllTracks,
    coverUrl,
    heavyCoverBytes,
    saveMetadata,
    saveCover,
    openEditor,
    closeEditor,
    setQuery,
    missingInfoFilter,
    setMissingInfoFilter,
    toggleSort,
    select,
    setSelected,
    toggleSelected,
    dismissReport,
    dismissVerification,
  };
});
