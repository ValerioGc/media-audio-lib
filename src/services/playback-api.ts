import { convertFileSrc, invoke } from '@tauri-apps/api/core';

import { isTauriRuntime } from '@/config/app-config';
import { ShellUnavailableError } from '@/services/library-api';

/**
 * URL the webview can load for a track.
 *
 * The backend checks the file is still there and grants the asset protocol access to it,
 * one file at a time.
 */
export async function playbackUrl(id: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new ShellUnavailableError();
  }

  return convertFileSrc(await invoke<string>('prepare_playback', { id }));
}
