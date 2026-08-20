<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import LibraryRow from '@/components/library/LibraryRow.vue';
import { LIBRARY_ROW_HEIGHT_REM, remToPixels } from '@/config/layout';
import { useVirtualList } from '@/composables/useVirtualList';
import {
  isSortableTableColumn,
  tableGridTemplate,
  visibleTableColumns,
} from '@/services/table-columns';
import { useSettingsStore } from '@/stores/settings';
import { type SortState, type SortableColumn, type TrackView } from '@/types/library';
import type { TableColumnKey } from '@/types/settings';

const props = defineProps<{
  tracks: readonly TrackView[];
  sort: SortState;
  selectedId: string | null;
  playingId: string | null;
}>();

const emit = defineEmits<{
  sort: [column: SortableColumn];
  select: [id: string];
  play: [track: TrackView];
  edit: [track: TrackView];
  remove: [track: TrackView];
  verify: [track: TrackView];
}>();

const { t } = useI18n();
const settings = useSettingsStore();

const viewport = ref<HTMLElement | null>(null);
const trackCount = computed(() => props.tracks.length);
const rowHeight = ref(remToPixels(LIBRARY_ROW_HEIGHT_REM));
const resizing = ref<{
  key: TableColumnKey;
  startX: number;
  startWidth: number;
} | null>(null);
const { range, onScroll, measure } = useVirtualList({
  itemCount: trackCount,
  itemHeight: rowHeight,
});

// Rows grow with the text size: the windowing maths needs the new height in pixels.
watch(
  () => settings.textSize,
  () => {
    rowHeight.value = remToPixels(LIBRARY_ROW_HEIGHT_REM);
    measure(viewport.value);
  },
);

const visibleTracks = computed(() => props.tracks.slice(range.value.start, range.value.end));

const columns = computed(() =>
  visibleTableColumns(settings.tableColumns).map((column) => ({
    ...column,
    label: t(`library.columns.${column.key}`),
    sortable: isSortableTableColumn(column.key),
    active: props.sort.column === column.key,
  })),
);

const gridStyle = computed(() => ({
  '--library_grid_columns': tableGridTemplate(settings.tableColumns),
}));

function ariaSort(column: TableColumnKey) {
  if (!isSortableTableColumn(column) || props.sort.column !== column) {
    return 'none';
  }

  return props.sort.direction === 'asc' ? 'ascending' : 'descending';
}

function sortColumn(column: TableColumnKey) {
  if (isSortableTableColumn(column)) {
    emit('sort', column);
  }
}

function stopResize() {
  if (typeof document === 'undefined') {
    return;
  }

  document.removeEventListener('pointermove', resizeColumn);
  document.removeEventListener('pointerup', stopResize);
  resizing.value = null;
}

function resizeColumn(event: PointerEvent) {
  const resize = resizing.value;

  if (resize === null) {
    return;
  }

  void settings.setTableColumnWidth(
    resize.key,
    resize.startWidth + Math.round(event.clientX - resize.startX),
  );
}

function startResize(event: PointerEvent, key: TableColumnKey, width: number) {
  event.preventDefault();
  event.stopPropagation();
  resizing.value = { key, startX: event.clientX, startWidth: width };
  document.addEventListener('pointermove', resizeColumn);
  document.addEventListener('pointerup', stopResize);
}

onMounted(() => measure(viewport.value));
onUnmounted(stopResize);
</script>

<template>
  <div class="library_table" role="table" :aria-rowcount="tracks.length" :style="gridStyle">
    <div class="library_table_head" role="row">
      <span
        v-for="column in columns"
        :key="column.key"
        class="library_table_heading"
        role="columnheader"
        :aria-sort="column.sortable ? ariaSort(column.key) : undefined"
      >
        <button
          v-if="column.sortable"
          class="library_table_sort"
          :class="{ library_table_sort_active: column.active }"
          type="button"
          :aria-label="t('library.sort.sortBy', { column: column.label })"
          @click="sortColumn(column.key)"
        >
          {{ column.label }}
          <AppIcon v-if="column.active" :name="sort.direction === 'asc' ? 'sortAsc' : 'sortDesc'" />
        </button>
        <span v-else>{{ column.label }}</span>
        <span
          class="library_table_resize"
          role="separator"
          :aria-label="t('library.columns.resize', { column: column.label })"
          aria-orientation="vertical"
          @pointerdown="startResize($event, column.key, column.width)"
        />
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
            :columns="columns"
            :selected="track.id === selectedId"
            :playing="track.id === playingId"
            @select="emit('select', $event)"
            @play="emit('play', $event)"
            @edit="emit('edit', $event)"
            @remove="emit('remove', $event)"
            @verify="emit('verify', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.library_table {
  --library_row_height: #{$library_row_height};

  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  @include surface_panel($radius_lg);

  &_head {
    display: grid;
    grid-template-columns: var(--library_grid_columns);
    gap: $space_md;
    align-items: center;
    padding: $space_sm $space_md;

    // The body reserves the scrollbar gutter: without the same room here the columns of
    // the header no longer line up with the ones of the rows.
    padding-right: calc(#{$space_md} + #{$scrollbar_size});
    border-bottom: 1px solid var(--color_border_strong);
    background-color: var(--color_surface_alt);
    font-size: 0.875em;
    color: var(--color_text_muted);
  }

  &_heading {
    position: relative;
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

  &_resize {
    position: absolute;
    top: $space_xs;
    right: -0.5rem;
    bottom: $space_xs;
    width: 0.75rem;
    cursor: col-resize;

    &::after {
      position: absolute;
      top: 0;
      right: 0.35rem;
      bottom: 0;
      width: 1px;
      background-color: var(--color_border_strong);
      content: '';
      opacity: 0;
      transition: opacity $duration_fast ease;
    }

    &:hover::after,
    &:focus-visible::after {
      opacity: 1;
    }
  }

  &_viewport {
    flex: 1;
    min-height: 0;

    @include scroll_area;
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
