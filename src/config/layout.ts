/** Height of one row of the list view, in rem. Keep in sync with `$library_row_height`. */
export const LIBRARY_ROW_HEIGHT_REM = 3.5;

/** Room left around the cover inside its cell, in pixels. */
export const LIBRARY_COVER_INSET_PX = 8;

/**
 * Width the title column needs before the playing badge spells itself out. Under it the
 * badge keeps only its symbol, so the title itself is left some room to be read.
 */
export const PLAYING_LABEL_MIN_TITLE_WIDTH_PX = 240;

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

/**
 * Height of a row for a given width of the cover column.
 *
 * The cover fills its column, so widening that column has to make the row taller as well:
 * otherwise the image would be cut off by the row instead of growing.
 */
export function libraryRowHeight(coverWidth: number): number {
  return Math.max(
    remToPixels(LIBRARY_ROW_HEIGHT_REM),
    Math.round(coverWidth) + LIBRARY_COVER_INSET_PX,
  );
}
