<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import LibraryRow from '@/components/library/LibraryRow.vue';
import { useVirtualList } from '@/composables/useVirtualList';
import {
  SORTABLE_COLUMNS,
  type SortState,
  type SortableColumn,
  type TrackView,
} from '@/types/library';

const props = defineProps<{
  tracks: readonly TrackView[];
  sort: SortState;
  selectedId: string | null;
}>();

const emit = defineEmits<{
  sort: [column: SortableColumn];
  select: [id: string];
  edit: [track: TrackView];
  remove: [track: TrackView];
}>();

const ROW_HEIGHT = 56;

const { t } = useI18n();

const viewport = ref<HTMLElement | null>(null);
const trackCount = computed(() => props.tracks.length);
const { range, onScroll, measure } = useVirtualList({
  itemCount: trackCount,
  itemHeight: ROW_HEIGHT,
});

const visibleTracks = computed(() => props.tracks.slice(range.value.start, range.value.end));

const columns = computed(() =>
  SORTABLE_COLUMNS.map((column) => ({
    key: column,
    label: t(`library.columns.${column}`),
    active: props.sort.column === column,
  })),
);

function ariaSort(column: SortableColumn) {
  if (props.sort.column !== column) {
    return 'none';
  }

  return props.sort.direction === 'asc' ? 'ascending' : 'descending';
}

onMounted(() => measure(viewport.value));
</script>

<template>
  <div class="library_table" role="table" :aria-rowcount="tracks.length">
    <div class="library_table_head" role="row">
      <span class="library_table_heading" role="columnheader">
        {{ t('library.columns.cover') }}
      </span>
      <span
        v-for="column in columns"
        :key="column.key"
        class="library_table_heading"
        role="columnheader"
        :aria-sort="ariaSort(column.key)"
      >
        <button
          class="library_table_sort"
          :class="{ library_table_sort_active: column.active }"
          type="button"
          :aria-label="t('library.sort.sortBy', { column: column.label })"
          @click="emit('sort', column.key)"
        >
          {{ column.label }}
          <AppIcon v-if="column.active" :name="sort.direction === 'asc' ? 'sortAsc' : 'sortDesc'" />
        </button>
      </span>
      <span class="library_table_heading" role="columnheader">
        {{ t('library.columns.duration') }}
      </span>
      <span class="library_table_heading library_table_heading_hidden" role="columnheader">
        {{ t('library.columns.actions') }}
      </span>
    </div>

    <div ref="viewport" class="library_table_viewport" @scroll="onScroll">
      <div class="library_table_spacer" :style="{ height: `${range.totalHeight}px` }">
        <div
          class="library_table_window"
          :style="{ transform: `translateY(${range.offsetTop}px)` }"
        >
          <LibraryRow
            v-for="track in visibleTracks"
            :key="track.id"
            :track="track"
            :selected="track.id === selectedId"
            @select="emit('select', $event)"
            @edit="emit('edit', $event)"
            @remove="emit('remove', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.library_table {
  --library_row_height: 56px;
  --library_grid_columns: 2.5rem minmax(0, 2fr) minmax(0, 1.5fr) minmax(0, 1.5fr) 4rem
    minmax(0, 1fr) 4.5rem 5.5rem;

  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--color_border);
  border-radius: $radius_lg;
  background-color: var(--color_surface);

  &_head {
    display: grid;
    grid-template-columns: var(--library_grid_columns);
    gap: $space_md;
    align-items: center;
    padding: $space_sm $space_md;
    border-bottom: 1px solid var(--color_border_strong);
    background-color: var(--color_surface_alt);
    font-size: 0.875em;
    color: var(--color_text_muted);
  }

  &_heading {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &_hidden {
      @include visually_hidden;
    }
  }

  &_sort {
    display: inline-flex;
    gap: $space_xs;
    align-items: center;
    padding: $space_xs $space_sm;
    border: 0;
    border-radius: $radius_sm;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;

    &:hover {
      background-color: var(--color_surface_hover);
    }

    &_active {
      color: var(--color_accent);
      font-weight: 600;
    }

    @include focus_ring;
  }

  &_viewport {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  &_spacer {
    position: relative;
  }

  &_window {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
  }
}
</style>
