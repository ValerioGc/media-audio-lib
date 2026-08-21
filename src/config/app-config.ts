export const APP_NAME = 'Media Audio Lib';

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '0.1.0';

/** Project site and repository shown in the settings header. Update here if they move. */
export const WEBSITE_URL = 'https://valeriogc.github.io/media-audio-lib/';
export const GITHUB_URL = 'https://github.com/ValerioGc/media-audio-lib';

/** Audio formats handled by the library. Tag reading lands in phase 3. */
export const SUPPORTED_EXTENSIONS = ['mp3', 'flac', 'm4a', 'ogg', 'wav'] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/** The same list widened: `includes` on a literal tuple rejects any other string. */
const SUPPORTED_EXTENSION_LIST: readonly string[] = SUPPORTED_EXTENSIONS;

/** True when the frontend runs inside the Tauri shell instead of a plain browser. */
export function isTauriRuntime(): boolean {
  return globalThis.window !== undefined && '__TAURI_INTERNALS__' in globalThis.window;
}

/** Lowercase extension of a path, without the dot. Empty string when there is none. */
export function fileExtension(path: string): string {
  const normalized = path.replaceAll('\\', '/');
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1);
  const dotIndex = fileName.lastIndexOf('.');

  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return '';
  }

  return fileName.slice(dotIndex + 1).toLowerCase();
}

export function isSupportedAudioFile(path: string): boolean {
  return SUPPORTED_EXTENSION_LIST.includes(fileExtension(path));
}
