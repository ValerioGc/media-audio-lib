<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDuration } from '@/services/track-sorting';
import type { TrackView } from '@/types/library';
import type { ViewMode } from '@/types/settings';

type FacetField = 'artist' | 'album' | 'genre';

export interface FacetGroupOpenPayload {
  field: FacetField;
  key: string;
  name: string;
}

interface FacetGroup extends FacetGroupOpenPayload {
  trackCount: number;
  albumCount: number;
  durationMs: number;
  artists: string[];
  isUnknown: boolean;
}

const props = defineProps<{
  tracks: readonly TrackView[];
  field: FacetField;
  viewMode: ViewMode;
}>();

const emit = defineEmits<{
  open: [group: FacetGroupOpenPayload];
}>();

const { t } = useI18n();

function facetValueOf(track: TrackView, field: FacetField): string {
  return track[field]?.trim() ?? '';
}

function groupLabelOf(field: FacetField, value: string): string {
  return value.length > 0 ? value : t(`library.groups.unknown.${field}`);
}

function uniqueValues(tracks: readonly TrackView[], field: FacetField): string[] {
  return [
    ...new Set(
      tracks.map((track) => groupLabelOf(field, facetValueOf(track, field))).filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function uniquePresentValues(tracks: readonly TrackView[], field: FacetField): string[] {
  return [
    ...new Set(
      tracks.map((track) => facetValueOf(track, field)).filter((value) => value.length > 0),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

const groups = computed<FacetGroup[]>(() => {
  const grouped = new Map<string, TrackView[]>();

  for (const track of props.tracks) {
    const value = facetValueOf(track, props.field);
    const key = value.length > 0 ? value : '__unknown__';
    grouped.set(key, [...(grouped.get(key) ?? []), track]);
  }

  return [...grouped.entries()]
    .map(([key, tracks]) => {
      const isUnknown = key === '__unknown__';

      return {
        field: props.field,
        key,
        name: isUnknown ? t(`library.groups.unknown.${props.field}`) : key,
        trackCount: tracks.length,
        albumCount: props.field === 'artist' ? uniquePresentValues(tracks, 'album').length : 0,
        durationMs: tracks.reduce((total, track) => total + track.durationMs, 0),
        artists: props.field === 'album' ? uniqueValues(tracks, 'artist') : [],
        isUnknown,
      };
    })
    .sort((left, right) => {
      if (left.isUnknown !== right.isUnknown) {
        return left.isUnknown ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    });
});

function openGroup(group: FacetGroup) {
  emit('open', { field: group.field, key: group.key, name: group.name });
}

function openGroupFromKeyboard(event: KeyboardEvent, group: FacetGroup) {
  event.preventDefault();
  openGroup(group);
}
</script>

<template>
  <div
    v-if="viewMode === 'preview'"
    class="library_facet_preview"
    :class="{ library_facet_preview_genre: field === 'genre' }"
    role="list"
    :aria-label="t(`library.groups.columns.${field}`)"
  >
    <article
      v-for="group in groups"
      :key="group.key"
      class="library_facet_card"
      role="button"
      tabindex="0"
      :aria-label="t('library.groups.openLabel', { name: group.name })"
      @click="openGroup(group)"
      @keydown.enter="openGroupFromKeyboard($event, group)"
      @keydown.space="openGroupFromKeyboard($event, group)"
    >
      <div class="library_facet_card_body">
        <p class="library_facet_card_label">{{ t(`library.groups.columns.${field}`) }}</p>
        <h3 class="library_facet_card_title">{{ group.name }}</h3>
        <p v-if="field === 'album'" class="library_facet_card_meta">
          {{ t('library.groups.albumArtist', { artists: group.artists.join(', ') }) }}
        </p>
        <p v-if="field === 'artist'" class="library_facet_card_meta">
          {{ t('library.groups.albumCount', { count: group.albumCount }, group.albumCount) }}
        </p>
        <p class="library_facet_card_meta">
          {{ t('library.groups.trackCount', { count: group.trackCount }, group.trackCount) }}
          <span aria-hidden="true"> · </span>
          {{ formatDuration(group.durationMs) }}
        </p>
      </div>
    </article>
  </div>

  <div
    v-else
    class="library_facet_list"
    :class="{
      library_facet_list_album: field === 'album',
      library_facet_list_artist: field === 'artist',
    }"
    role="table"
    :aria-rowcount="groups.length"
  >
    <div class="library_facet_list_head" role="row">
      <span class="library_facet_list_heading" role="columnheader">
        {{ t(`library.groups.columns.${field}`) }}
      </span>
      <span v-if="field === 'album'" class="library_facet_list_heading" role="columnheader">
        {{ t('library.groups.columns.artist') }}
      </span>
      <span v-if="field === 'artist'" class="library_facet_list_heading" role="columnheader">
        {{ t('library.groups.columns.albums') }}
      </span>
      <span class="library_facet_list_heading" role="columnheader">
        {{ t('library.groups.columns.tracks') }}
      </span>
      <span class="library_facet_list_heading" role="columnheader">
        {{ t('library.groups.columns.duration') }}
      </span>
    </div>

    <div class="library_facet_list_body">
      <div
        v-for="group in groups"
        :key="group.key"
        class="library_facet_list_row"
        role="row"
        tabindex="0"
        :aria-label="t('library.groups.openLabel', { name: group.name })"
        @click="openGroup(group)"
        @keydown.enter="openGroupFromKeyboard($event, group)"
        @keydown.space="openGroupFromKeyboard($event, group)"
      >
        <span class="library_facet_list_cell library_facet_list_name" role="cell">
          {{ group.name }}
        </span>
        <span v-if="field === 'album'" class="library_facet_list_cell" role="cell">
          {{ group.artists.join(', ') }}
        </span>
        <span v-if="field === 'artist'" class="library_facet_list_cell" role="cell">
          {{ t('library.groups.albumCount', { count: group.albumCount }, group.albumCount) }}
        </span>
        <span class="library_facet_list_cell" role="cell">
          {{ t('library.groups.trackCount', { count: group.trackCount }, group.trackCount) }}
        </span>
        <span class="library_facet_list_cell library_facet_list_duration" role="cell">
          {{ formatDuration(group.durationMs) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.library_facet_preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: $space_md;
  flex: 1;
  min-height: 0;
  padding-bottom: $space_md;

  @include scroll_area;

  &_genre {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
  }
}

.library_facet_card {
  display: flex;
  flex-direction: column;
  gap: $space_md;
  justify-content: space-between;
  min-height: 10rem;
  padding: $space_md;
  @include surface_panel($radius_md);
  cursor: pointer;
  transition:
    background-color $duration_fast ease,
    border-color $duration_fast ease;

  &:hover {
    background-color: var(--color_surface_hover);
  }

  @include focus_ring;

  &_body {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    min-width: 0;
  }

  &_label {
    color: var(--color_text_muted);
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
  }

  &_title {
    overflow: hidden;
    font-size: 1.1em;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_meta {
    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.875em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.library_facet_list {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--color_border);
  border-radius: $radius_md;

  &_head,
  &_row {
    display: grid;
    grid-template-columns: minmax(10rem, 1.4fr) minmax(7rem, 0.55fr) minmax(6rem, 0.45fr);
    gap: $space_md;
    align-items: center;
    min-height: 3rem;
    padding: 0 $space_md;
  }

  &_album &_head,
  &_album &_row,
  &_artist &_head,
  &_artist &_row {
    grid-template-columns:
      minmax(10rem, 1.2fr) minmax(10rem, 1fr) minmax(7rem, 0.45fr)
      minmax(6rem, 0.35fr);
  }

  &_head {
    border-bottom: 1px solid var(--color_border);
    background-color: var(--color_surface_alt);
  }

  &_heading {
    color: var(--color_text_muted);
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
  }

  &_body {
    min-height: 0;

    @include scroll_area;
  }

  &_row {
    border-bottom: 1px solid var(--color_border);
    cursor: pointer;
    transition: background-color $duration_fast ease;

    &:last-child {
      border-bottom: 0;
    }

    &:hover {
      background-color: var(--color_surface_hover);
    }

    @include focus_ring;
  }

  &_cell {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_name {
    font-weight: 600;
  }

  &_duration {
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 760px) {
    &_head,
    &_row {
      grid-template-columns: minmax(8rem, 1fr) minmax(5rem, auto) minmax(5rem, auto);
    }

    &_album &_head,
    &_album &_row,
    &_artist &_head,
    &_artist &_row {
      grid-template-columns: minmax(8rem, 1fr) minmax(8rem, 1fr) minmax(5rem, auto);
    }

    &_album &_duration,
    &_album &_heading:last-child,
    &_artist &_duration,
    &_artist &_heading:last-child {
      display: none;
    }
  }
}
</style>
