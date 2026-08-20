<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
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
  durationMs: number;
  examples: string[];
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
        field: props.field,
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

function openGroup(group: FacetGroup) {
  emit('open', { field: group.field, key: group.key, name: group.name });
}
</script>

<template>
  <div
    v-if="viewMode === 'preview'"
    class="library_facet_preview"
    role="list"
    :aria-label="t(`library.groups.columns.${field}`)"
  >
    <article v-for="group in groups" :key="group.key" class="library_facet_card" role="listitem">
      <div class="library_facet_card_body">
        <p class="library_facet_card_label">{{ t(`library.groups.columns.${field}`) }}</p>
        <h3 class="library_facet_card_title">{{ group.name }}</h3>
        <p class="library_facet_card_meta">
          {{ t('library.groups.trackCount', { count: group.trackCount }, group.trackCount) }}
          <span aria-hidden="true"> · </span>
          {{ formatDuration(group.durationMs) }}
        </p>
        <p class="library_facet_card_examples" :title="group.examples.join(', ')">
          {{ group.examples.join(', ') }}
        </p>
      </div>

      <AppButton class="library_facet_card_open" @click="openGroup(group)">
        {{ t('library.groups.open') }}
      </AppButton>
    </article>
  </div>

  <div v-else class="library_facet_list" role="table" :aria-rowcount="groups.length">
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
      <span class="library_facet_list_heading" role="columnheader">
        {{ t('library.groups.columns.actions') }}
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
        <span class="library_facet_list_cell" role="cell">
          <AppButton class="library_facet_list_open" @click="openGroup(group)">
            {{ t('library.groups.open') }}
          </AppButton>
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
}

.library_facet_card {
  display: flex;
  flex-direction: column;
  gap: $space_md;
  justify-content: space-between;
  min-height: 10rem;
  padding: $space_md;
  @include surface_panel($radius_md);

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

  &_meta,
  &_examples {
    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.875em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_open {
    align-self: flex-start;
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
    grid-template-columns:
      minmax(10rem, 1.3fr) minmax(7rem, 0.55fr) minmax(6rem, 0.45fr)
      minmax(12rem, 1.8fr) minmax(6rem, auto);
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

  &_open {
    white-space: nowrap;
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
