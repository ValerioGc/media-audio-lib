export const APP_NAME = 'Media Audio Lib';

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '0.1.0';

/** Repository shown in the settings footer. Update here if the project moves. */
export const GITHUB_URL = 'https://github.com/ValerioGc/media-audio-lib';

/** Audio formats handled by the library. Tag reading lands in phase 3. */
export const SUPPORTED_EXTENSIONS = ['mp3', 'flac', 'm4a', 'ogg', 'wav'] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/** True when the frontend runs inside the Tauri shell instead of a plain browser. */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Lowercase extension of a path, without the dot. Empty string when there is none. */
export function fileExtension(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1);
  const dotIndex = fileName.lastIndexOf('.');

  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return '';
  }

  return fileName.slice(dotIndex + 1).toLowerCase();
}

export function isSupportedAudioFile(path: string): boolean {
  const extension = fileExtension(path);
  return SUPPORTED_EXTENSIONS.some((supported) => supported === extension);
}
