<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import LibraryColumnSettingsDialog from '@/components/library/LibraryColumnSettingsDialog.vue';
import LibraryRow from '@/components/library/LibraryRow.vue';
import { LIBRARY_ROW_HEIGHT_REM, remToPixels } from '@/config/layout';
import { useVirtualList } from '@/composables/useVirtualList';
import {
  isSortableTableColumn,
  tableGridTemplate,
  visibleTableColumns,
} from '@/services/table-columns';
import { useSettingsStore } from '@/stores/settings';
import {
  type SortState,
  type SortableColumn,
  type TrackSelectionIntent,
  type TrackView,
} from '@/types/library';
import type { TableColumnKey } from '@/types/settings';

const props = withDefaults(
  defineProps<{
    tracks: readonly TrackView[];
    sort: SortState;
    selectedIds: readonly string[];
    playingId: string | null;
    hiddenColumnKeys?: readonly TableColumnKey[];
    showColumnSettings?: boolean;
  }>(),
  { hiddenColumnKeys: () => [], showColumnSettings: true },
);

const emit = defineEmits<{
  sort: [column: SortableColumn];
  select: [intent: TrackSelectionIntent];
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
const isColumnSettingsOpen = ref(false);
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
  visibleTableColumns(settings.tableColumns)
    .filter((column) => !props.hiddenColumnKeys.includes(column.key))
    .map((column) => ({
      ...column,
      label: t(`library.columns.${column.key}`),
      sortable: isSortableTableColumn(column.key),
      active: props.sort.column === column.key,
    })),
);

const gridStyle = computed(() => ({
  '--library_grid_columns': tableGridTemplate(columns.value),
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
        :class="{ library_table_heading_resizing: resizing?.key === column.key }"
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
          :title="t('library.columns.resize', { column: column.label })"
          aria-orientation="vertical"
          @pointerdown="startResize($event, column.key, column.width)"
        />
      </span>
      <span
        class="library_table_heading library_table_heading_actions"
        role="columnheader"
        :aria-label="t('library.columns.actions')"
      >
        <button
          v-if="showColumnSettings"
          class="library_table_settings"
          type="button"
          :aria-label="t('library.columnSettings.open')"
          :title="t('library.columnSettings.open')"
          data-testid="table-column-settings"
          @click="isColumnSettingsOpen = true"
        >
          <AppIcon name="settings" />
        </button>
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
            :selected="selectedIds.includes(track.id)"
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

    <LibraryColumnSettingsDialog
      :open="isColumnSettingsOpen"
      @close="isColumnSettingsOpen = false"
    />
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

    &_actions {
      display: flex;
      justify-content: flex-end;
      overflow: visible;
    }

    &_resizing .library_table_resize::before,
    &_resizing .library_table_resize::after {
      opacity: 1;
      background-color: var(--color_accent);
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
    top: 0;
    right: calc(#{$space_md} / -2);
    bottom: 0;
    width: $space_md;
    cursor: col-resize;

    &::before,
    &::after {
      position: absolute;
      top: $space_xs;
      bottom: $space_xs;
      background-color: var(--color_border_strong);
      content: '';
      opacity: 0.55;
      transition: opacity $duration_fast ease;
    }

    &::before {
      left: 50%;
      width: 2px;
      border-radius: 999px;
      transform: translateX(-50%);
    }

    &::after {
      right: 0.18rem;
      width: 1px;
      opacity: 0.25;
    }

    &:hover::before,
    &:hover::after,
    &:focus-visible::before,
    &:focus-visible::after {
      opacity: 1;
      background-color: var(--color_accent);
    }
  }

  &_settings {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--color_border);
    border-radius: $radius_sm;
    background-color: var(--color_surface);
    color: var(--color_text_muted);
    cursor: pointer;

    &:hover {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    @include focus_ring;
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
