/** Mirrors the Rust models: the backend serializes them in camelCase. */

export interface Track {
  id: string;
  path: string;
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
  durationMs: number;
  format: string;
  hasCover: boolean;
  addedAt: number;
}

export interface TrackView extends Track {
  missing: boolean;
}

export interface FailedImport {
  path: string;
  reason: string;
}

export interface AddReport {
  added: Track[];
  duplicates: string[];
  failed: FailedImport[];
}

export interface LibraryInfo {
  name: string;
}

export interface Cover {
  mimeType: string;
  data: string;
}

/** Payload of the `write_metadata` command: `null` clears the corresponding tag. */
export interface MetadataUpdate {
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
}

export const SORTABLE_COLUMNS = ['title', 'artist', 'album', 'year', 'genre'] as const;
export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: SortableColumn;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = { column: 'title', direction: 'asc' };
