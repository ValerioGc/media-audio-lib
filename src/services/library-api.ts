import { invoke } from '@tauri-apps/api/core';

import { APP_NAME, isTauriRuntime, SUPPORTED_EXTENSIONS } from '@/config/app-config';
import type {
  AddReport,
  Cover,
  LibraryInfo,
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
