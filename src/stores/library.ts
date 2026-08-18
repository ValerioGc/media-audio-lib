import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import * as api from '@/services/library-api';
import { ShellUnavailableError } from '@/services/library-api';
import { filterAndSort } from '@/services/track-sorting';
import {
  DEFAULT_SORT,
  type AddReport,
  type Cover,
  type MetadataUpdate,
  type SortableColumn,
  type SortState,
  type Track,
  type TrackView,
} from '@/types/library';

/** i18n key describing the last failure, so the UI stays free of hardcoded text. */
export type LibraryErrorKey = 'shellUnavailable' | 'generic' | null;

function errorKeyOf(error: unknown): Exclude<LibraryErrorKey, null> {
  return error instanceof ShellUnavailableError ? 'shellUnavailable' : 'generic';
}

export const useLibraryStore = defineStore('library', () => {
  const tracks = ref<TrackView[]>([]);
  const query = ref('');
  const sort = ref<SortState>({ ...DEFAULT_SORT });
  const selectedId = ref<string | null>(null);
  const editingId = ref<string | null>(null);
  const isLoading = ref(false);
  const isImporting = ref(false);
  const isSaving = ref(false);
  const lastReport = ref<AddReport | null>(null);
  const errorKey = ref<LibraryErrorKey>(null);
  const covers = ref(new Map<string, string>());

  const visibleTracks = computed(() => filterAndSort(tracks.value, query.value, sort.value));
  const editingTrack = computed(
    () => tracks.value.find((track) => track.id === editingId.value) ?? null,
  );
  const isEmpty = computed(() => tracks.value.length === 0);
  const hasNoMatches = computed(() => !isEmpty.value && visibleTracks.value.length === 0);
  const missingCount = computed(() => tracks.value.filter((track) => track.missing).length);

  function fail(error: unknown) {
    errorKey.value = errorKeyOf(error);
  }

  async function load() {
    isLoading.value = true;
    errorKey.value = null;

    try {
      tracks.value = await api.listTracks();
    } catch (error) {
      fail(error);
    } finally {
      isLoading.value = false;
    }
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
    try {
      const paths = await api.pickAudioFiles();

      return await addPaths(paths);
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

  return {
    tracks,
    query,
    sort,
    selectedId,
    editingId,
    isLoading,
    isImporting,
    isSaving,
    lastReport,
    errorKey,
    covers,
    visibleTracks,
    editingTrack,
    isEmpty,
    hasNoMatches,
    missingCount,
    load,
    addPaths,
    pickAndAdd,
    remove,
    loadCover,
    saveMetadata,
    saveCover,
    openEditor,
    closeEditor,
    setQuery,
    toggleSort,
    select,
    dismissReport,
  };
});
