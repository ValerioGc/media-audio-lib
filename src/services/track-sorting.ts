import type { SortState, TrackView } from '@/types/library';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Keeps the tracks whose title, album, genre or path contain the query. */
export function filterTracks(tracks: readonly TrackView[], query: string): TrackView[] {
  const needle = normalize(query);

  if (needle === '') {
    return [...tracks];
  }

  return tracks.filter((track) =>
    [track.title, track.artist, track.album, track.genre, track.path].some(
      (field) => field !== null && normalize(field).includes(needle),
    ),
  );
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });
}

function valueOf(track: TrackView, column: SortState['column']): string | number | null {
  const value = track[column];

  return value === '' ? null : value;
}

function compareValues(left: string | number, right: string | number): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return compareText(String(left), String(right));
}

export function sortTracks(tracks: readonly TrackView[], sort: SortState): TrackView[] {
  const sign = sort.direction === 'asc' ? 1 : -1;

  return [...tracks].sort((left, right) => {
    const leftValue = valueOf(left, sort.column);
    const rightValue = valueOf(right, sort.column);

    // Empty fields sink to the bottom in both directions, so the sign is applied
    // only when both entries actually carry a value.
    if (leftValue === null || rightValue === null) {
      if (leftValue === rightValue) {
        return compareText(left.title, right.title);
      }

      return leftValue === null ? 1 : -1;
    }

    const outcome = compareValues(leftValue, rightValue);

    return outcome === 0 ? compareText(left.title, right.title) : outcome * sign;
  });
}

export function filterAndSort(
  tracks: readonly TrackView[],
  query: string,
  sort: SortState,
): TrackView[] {
  return sortTracks(filterTracks(tracks, query), sort);
}

/** Formats a duration in milliseconds as `m:ss`, or `h:mm:ss` past the hour. */
export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours === 0) {
    return `${minutes}:${paddedSeconds}`;
  }

  return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
}
