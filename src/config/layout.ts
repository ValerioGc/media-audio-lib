/** Height of one row of the list view, in rem. Keep in sync with `$library_row_height`. */
export const LIBRARY_ROW_HEIGHT_REM = 3.5;

const FALLBACK_ROOT_FONT_SIZE = 16;

/**
 * Converts rem to pixels using the current root font size.
 *
 * The text size setting scales the root font, so anything measured in JavaScript has to be
 * read again when that setting changes instead of being fixed at build time.
 */
export function remToPixels(value: number): number {
  if (typeof document === 'undefined') {
    return value * FALLBACK_ROOT_FONT_SIZE;
  }

  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const base =
    Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : FALLBACK_ROOT_FONT_SIZE;

  return value * base;
}
