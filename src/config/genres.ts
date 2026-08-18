/**
 * Genres offered by the dropdown. The tag itself is free text, so the user can
 * always type a value that is not listed here.
 */
export const GENRES = [
  'Blues',
  'Classica',
  'Country',
  'Dance',
  'Elettronica',
  'Folk',
  'Hip Hop',
  'Indie',
  'Jazz',
  'Metal',
  'Pop',
  'Punk',
  'R&B',
  'Reggae',
  'Rock',
  'Soundtrack',
] as const;

export type Genre = (typeof GENRES)[number];
