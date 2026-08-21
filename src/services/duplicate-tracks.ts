import type { TrackView } from '@/types/library';

/** The same song held twice, as two different files. */
export interface DuplicateGroup {
  key: string;
  title: string;
  artist: string | null;
  tracks: TrackView[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, ' ');
}

/**
 * Groups the tracks that name the same song, whatever file they came from.
 *
 * Title and artist are what a listener calls the same song: the two copies are usually
 * different files, encoded differently and often of a slightly different length, so the
 * duration is left out of the match and shown instead, to be read before choosing.
 */
export function duplicateGroups(tracks: readonly TrackView[]): DuplicateGroup[] {
  const groups = new Map<string, DuplicateGroup>();

  for (const track of tracks) {
    const title = normalize(track.title);

    if (title === '') {
      continue;
    }

    const key = `${title}\u0000${normalize(track.artist ?? '')}`;
    const group = groups.get(key);

    if (group === undefined) {
      groups.set(key, { key, title: track.title, artist: track.artist, tracks: [track] });
      continue;
    }

    group.tracks.push(track);
  }

  return [...groups.values()]
    .filter((group) => group.tracks.length > 1)
    .sort((left, right) => left.title.localeCompare(right.title));
}
