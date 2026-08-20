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
  standalone?: boolean;
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

/** One library of the catalog, as listed in the settings and in the homepage menu. */
export interface LibrarySummary {
  id: string;
  name: string;
  trackCount: number;
  active: boolean;
}

export type LibraryImportStrategy = 'replace' | 'merge' | 'mergeSkipDuplicates';

export interface LibraryImportReport {
  added: number;
  updated: number;
  skipped: number;
  missing: string[];
  total: number;
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

export const LIBRARY_CONTENT_TABS = ['tracks', 'artists', 'albums', 'genres'] as const;
export type LibraryContentTab = (typeof LIBRARY_CONTENT_TABS)[number];

export const MISSING_INFO_FILTERS = [
  'all',
  'file',
  'cover',
  'artist',
  'album',
  'year',
  'genre',
] as const;
export type MissingInfoFilter = (typeof MISSING_INFO_FILTERS)[number];

export const TRACK_EXPORT_FORMATS = ['csv', 'txt'] as const;
export type TrackExportFormat = (typeof TRACK_EXPORT_FORMATS)[number];

export const TRACK_EXPORT_FIELDS = [
  'title',
  'artist',
  'album',
  'year',
  'genre',
  'duration',
  'format',
  'path',
  'missing',
] as const;
export type TrackExportField = (typeof TRACK_EXPORT_FIELDS)[number];

export interface TrackListVerificationReport {
  total: number;
  missing: number;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: SortableColumn;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = { column: 'title', direction: 'asc' };
