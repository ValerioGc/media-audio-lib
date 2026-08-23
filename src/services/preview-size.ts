import type { PreviewSize, PreviewSizePage } from '@/types/settings';

/** The page a list of groups is shown on, by the field it groups the library by. */
export const FACET_PAGES: Record<'artist' | 'album' | 'genre', PreviewSizePage> = {
  artist: 'artists',
  album: 'albums',
  genre: 'genres',
};

/**
 * The narrowest a card of the track preview may be, per size.
 *
 * The grid fills the row with as many cards as fit above this floor, so the number that
 * changes here is how many end up on a line — which is what "bigger cards" means to
 * someone looking at a window of a fixed width.
 */
const TRACK_CARD_WIDTHS: Record<PreviewSize, string> = {
  small: '7rem',
  medium: '9rem',
  large: '12rem',
};

/** The same for the cards of artists, albums and genres, which carry more than a title. */
const GROUP_CARD_WIDTHS: Record<PreviewSize, string> = {
  small: '10rem',
  medium: '13rem',
  large: '17rem',
};

export function trackCardWidth(size: PreviewSize): string {
  return TRACK_CARD_WIDTHS[size];
}

export function groupCardWidth(size: PreviewSize): string {
  return GROUP_CARD_WIDTHS[size];
}
