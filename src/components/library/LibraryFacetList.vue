<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDuration } from '@/services/track-sorting';
import type { TrackView } from '@/types/library';

type FacetField = 'artist' | 'album' | 'genre';

interface FacetGroup {
  key: string;
  name: string;
  trackCount: number;
  durationMs: number;
  examples: string[];
  isUnknown: boolean;
}

const props = defineProps<{
  tracks: readonly TrackView[];
  field: FacetField;
}>();

const { t } = useI18n();

const groups = computed<FacetGroup[]>(() => {
  const grouped = new Map<string, TrackView[]>();

  for (const track of props.tracks) {
    const value = track[props.field]?.trim() ?? '';
    const key = value.length > 0 ? value : '__unknown__';
    grouped.set(key, [...(grouped.get(key) ?? []), track]);
  }

  return [...grouped.entries()]
    .map(([key, tracks]) => {
      const isUnknown = key === '__unknown__';

      return {
        key,
        name: isUnknown ? t(`library.groups.unknown.${props.field}`) : key,
        trackCount: tracks.length,
        durationMs: tracks.reduce((total, track) => total + track.durationMs, 0),
        examples: tracks.slice(0, 3).map((track) => track.title),
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
</script>

<template>
  <div class="library_facet_list" role="table" :aria-rowcount="groups.length">
    <div class="library_facet_list_head" role="row">
      <span class="library_facet_list_heading" role="columnheader">
        {{ t(`library.groups.columns.${field}`) }}
      </span>
      <span class="library_facet_list_heading" role="columnheader">
        {{ t('library.groups.columns.tracks') }}
      </span>
      <span class="library_facet_list_heading" role="columnheader">
        {{ t('library.groups.columns.duration') }}
      </span>
      <span class="library_facet_list_heading" role="columnheader">
        {{ t('library.groups.columns.examples') }}
      </span>
    </div>

    <div class="library_facet_list_body">
      <div v-for="group in groups" :key="group.key" class="library_facet_list_row" role="row">
        <span class="library_facet_list_cell library_facet_list_name" role="cell">
          {{ group.name }}
        </span>
        <span class="library_facet_list_cell" role="cell">
          {{ t('library.groups.trackCount', { count: group.trackCount }, group.trackCount) }}
        </span>
        <span class="library_facet_list_cell library_facet_list_duration" role="cell">
          {{ formatDuration(group.durationMs) }}
        </span>
        <span class="library_facet_list_cell library_facet_list_examples" role="cell">
          {{ group.examples.join(', ') }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
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
    grid-template-columns: minmax(10rem, 1.4fr) minmax(7rem, 0.6fr) minmax(6rem, 0.5fr) minmax(
        12rem,
        2fr
      );
    gap: $space_md;
    align-items: center;
    min-height: 3rem;
    padding: 0 $space_md;
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

    &:last-child {
      border-bottom: 0;
    }
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

  &_examples {
    color: var(--color_text_muted);
  }

  @media (max-width: 760px) {
    &_head,
    &_row {
      grid-template-columns: minmax(8rem, 1fr) minmax(5rem, auto) minmax(5rem, auto);
    }

    &_heading:last-child,
    &_examples {
      display: none;
    }
  }
}
</style>
