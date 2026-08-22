import { convertFileSrc, invoke } from '@tauri-apps/api/core';

import { isTauriRuntime } from '@/config/app-config';
import { ShellUnavailableError } from '@/services/library-api';
import type { TrackView } from '@/types/library';

/**
 * URL the webview can load for a track.
 *
 * The backend checks the file is still there and grants the asset protocol access to it,
 * one file at a time.
 */
export async function playbackUrl(track: TrackView): Promise<string> {
  if (!isTauriRuntime()) {
    throw new ShellUnavailableError();
  }

  // The file opened from the system is known to the shell: it is asked for, not named.
  const path =
    track.standalone === true
      ? await invoke<string>('prepare_external_playback')
      : await invoke<string>('prepare_playback', { id: track.id });

  return convertFileSrc(path);
}

export async function startupAudioFile(): Promise<TrackView | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const track = await invoke<TrackView | null>('startup_audio_file');

    return track === null ? null : { ...track, standalone: true };
  } catch (error) {
    console.error('Unable to read the startup audio file', error);

    return null;
  }
}
