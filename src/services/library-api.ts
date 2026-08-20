import { invoke } from '@tauri-apps/api/core';

import { APP_NAME, isTauriRuntime, SUPPORTED_EXTENSIONS } from '@/config/app-config';
import type {
  AddReport,
  Cover,
  LibraryInfo,
  LibraryImportReport,
  LibraryImportStrategy,
  LibrarySummary,
  TrackExportField,
  TrackExportFormat,
  MetadataUpdate,
  Track,
  TrackView,
} from '@/types/library';

/** Raised when a feature needs the desktop shell and the app runs in a plain browser. */
export class ShellUnavailableError extends Error {
  constructor() {
    super('shell-unavailable');
    this.name = 'ShellUnavailableError';
  }
}

function requireShell() {
  if (!isTauriRuntime()) {
    throw new ShellUnavailableError();
  }
}

export async function listTracks(): Promise<TrackView[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  return invoke<TrackView[]>('list_tracks');
}

export async function libraryInfo(): Promise<LibraryInfo> {
  if (!isTauriRuntime()) {
    return { name: APP_NAME };
  }

  return invoke<LibraryInfo>('library_info');
}

export async function renameLibrary(name: string): Promise<LibraryInfo> {
  requireShell();

  return invoke<LibraryInfo>('rename_library', { name });
}

export async function listLibraries(): Promise<LibrarySummary[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  return invoke<LibrarySummary[]>('list_libraries');
}

export async function createLibrary(name: string): Promise<LibrarySummary> {
  requireShell();

  return invoke<LibrarySummary>('create_library', { name });
}

export async function switchLibrary(id: string): Promise<LibraryInfo> {
  requireShell();

  return invoke<LibraryInfo>('switch_library', { id });
}

export async function deleteLibrary(id: string): Promise<LibrarySummary[]> {
  requireShell();

  return invoke<LibrarySummary[]>('delete_library', { id });
}

/** Writes a copy of the library to `destination` and returns the file written. */
export async function exportLibrary(id: string, destination: string): Promise<string> {
  requireShell();

  return invoke<string>('export_library', { id, destination });
}

export async function exportTrackList(
  destination: string,
  format: TrackExportFormat,
  fields: readonly TrackExportField[],
): Promise<string> {
  requireShell();

  return invoke<string>('export_track_list', { destination, format, fields: [...fields] });
}

export async function importLibrary(
  source: string,
  strategy: LibraryImportStrategy,
): Promise<LibraryImportReport> {
  requireShell();

  return invoke<LibraryImportReport>('import_library', { source, strategy });
}

/** Opens the save dialog for an export, returning null when the user cancels. */
export async function pickExportFile(defaultName: string): Promise<string | null> {
  requireShell();

  const { save } = await import('@tauri-apps/plugin-dialog');

  return save({
    defaultPath: `${defaultName}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
}

export async function pickTrackListExportFile(
  defaultName: string,
  format: TrackExportFormat,
): Promise<string | null> {
  requireShell();

  const { save } = await import('@tauri-apps/plugin-dialog');
  const extension = format === 'csv' ? 'csv' : 'txt';
  const filterName = format === 'csv' ? 'CSV' : 'TXT';

  return save({
    defaultPath: `${defaultName}-tracks.${extension}`,
    filters: [{ name: filterName, extensions: [extension] }],
  });
}

/** Opens the file picker for an app library JSON, returning null when cancelled. */
export async function pickImportFile(): Promise<string | null> {
  requireShell();

  const { open } = await import('@tauri-apps/plugin-dialog');
  const selection = await open({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  return Array.isArray(selection) ? (selection[0] ?? null) : selection;
}

export async function addTracks(paths: readonly string[]): Promise<AddReport> {
  requireShell();

  return invoke<AddReport>('add_tracks', { paths: [...paths] });
}

export async function removeTrack(id: string): Promise<boolean> {
  requireShell();

  return invoke<boolean>('remove_track', { id });
}

export async function verifyTrackFile(id: string): Promise<TrackView> {
  requireShell();

  return invoke<TrackView>('verify_track_file', { id });
}

export async function getCover(path: string): Promise<Cover | null> {
  requireShell();

  return invoke<Cover | null>('get_cover', { path });
}

export async function writeMetadata(id: string, update: MetadataUpdate): Promise<Track> {
  requireShell();

  return invoke<Track>('write_metadata', { id, update });
}

export async function writeCover(id: string, cover: Cover | null): Promise<Track> {
  requireShell();

  return invoke<Track>('write_cover', { id, cover });
}

/** Opens the system picker and returns the selected files, empty when cancelled. */
export async function pickAudioFiles(): Promise<string[]> {
  requireShell();

  const { open } = await import('@tauri-apps/plugin-dialog');
  const selection = await open({
    multiple: true,
    filters: [{ name: 'Audio', extensions: [...SUPPORTED_EXTENSIONS] }],
  });

  if (selection === null) {
    return [];
  }

  return Array.isArray(selection) ? selection : [selection];
}

/** Opens the system picker on folders: everything audio inside is imported. */
export async function pickFolders(): Promise<string[]> {
  requireShell();

  const { open } = await import('@tauri-apps/plugin-dialog');
  const selection = await open({ multiple: true, directory: true });

  if (selection === null) {
    return [];
  }

  return Array.isArray(selection) ? selection : [selection];
}

export function coverDataUrl(cover: Cover): string {
  return `data:${cover.mimeType};base64,${cover.data}`;
}
