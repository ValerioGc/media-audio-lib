<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import LibraryColumnSettingsDialog from '@/components/library/LibraryColumnSettingsDialog.vue';
import LibraryRow from '@/components/library/LibraryRow.vue';
import { fixedCoverWidth, libraryRowHeight } from '@/config/layout';
import { useVirtualList } from '@/composables/useVirtualList';
import {
  fittedTableColumnWidths,
  isResizableTableColumn,
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
import { TABLE_COLUMN_KEYS, TABLE_COLUMN_WIDTHS, type TableColumnKey } from '@/types/settings';

const props = withDefaults(
  defineProps<{
    tracks: readonly TrackView[];
    sort: SortState;
    selectedIds: readonly string[];
    playingId: string | null;
    columnKeys?: readonly TableColumnKey[] | undefined;
    showColumnSettings?: boolean;
  }>(),
  { columnKeys: undefined, showColumnSettings: true },
);

const emit = defineEmits<{
  sort: [column: SortableColumn];
  select: [intent: TrackSelectionIntent];
  play: [track: TrackView];
  edit: [track: TrackView];
  remove: [track: TrackView];
}>();

const { t } = useI18n();
const settings = useSettingsStore();

const viewport = ref<HTMLElement | null>(null);
const trackCount = computed(() => props.tracks.length);
const rowHeight = ref(0);
const isColumnSettingsOpen = ref(false);
const resizing = ref<{
  key: TableColumnKey;
  direction: 1 | -1;
  startX: number;
  startWidth: number;
} | null>(null);
const { range, onScroll, measure } = useVirtualList({
  itemCount: trackCount,
  itemHeight: rowHeight,
});

// The row is measured in pixels, so the fixed cover is read again whenever the text size
// changes the size of a rem.
const fixedCover = ref(fixedCoverWidth());

watch(
  () => settings.textSize,
  () => {
    fixedCover.value = fixedCoverWidth();
  },
);

// Only the track list of the library lets the cover be resized: everywhere else it is a
// square of the row, so every contextual table shows covers of the same size.
const coverColumnWidth = computed(() =>
  props.columnKeys === undefined
    ? (settings.tableColumns.find((column) => column.key === 'cover')?.width ??
      TABLE_COLUMN_WIDTHS.cover.default)
    : fixedCover.value,
);

// Rows grow with the text size and with the cover column: the windowing maths needs the
// new height in pixels, and the rows read it back from the same value.
watch(
  [() => settings.textSize, coverColumnWidth],
  () => {
    rowHeight.value = libraryRowHeight(coverColumnWidth.value);
    measure(viewport.value);
  },
  { immediate: true },
);

// A contextual table lists the columns it needs: the library settings only lend their widths,
// so what the main list shows cannot add or drop a column here.
const columnSettings = computed(() => {
  const keys = props.columnKeys;

  if (keys === undefined) {
    return visibleTableColumns(settings.tableColumns);
  }

  return keys.map((key) => ({
    ...(settings.tableColumns.find((column) => column.key === key) ?? {
      key,
      width: TABLE_COLUMN_WIDTHS[key].default,
    }),
    ...(key === 'cover' ? { width: coverColumnWidth.value } : {}),
    visible: true,
  }));
});

const columns = computed(() =>
  columnSettings.value.map((column) => ({
    ...column,
    label: t(`library.columns.${column.key}`),
    sortable: isSortableTableColumn(column.key),
    resizable: props.columnKeys === undefined && isResizableTableColumn(column.key),
    active: props.sort.column === column.key,
  })),
);

/**
 * The handle standing on the right edge of each column, where one is any use.
 *
 * A boundary lies between two columns and the pointer cannot say which of them it means,
 * so the rule is fixed: it moves the column on its left, the way a spreadsheet does. When
 * that side cannot move — the title stretches, a year and a duration are fixed — it moves
 * the column on the right instead, which means growing as the pointer goes left. Where
 * neither side can move there is no handle at all: a separator that answers to nothing is
 * an invitation to a drag that does nothing.
 */
const headings = computed(() =>
  columns.value.map((column, index) => {
    if (column.resizable) {
      return { column, handle: { key: column.key, label: column.label, direction: 1 as const } };
    }

    const next = columns.value[index + 1];

    if (next?.resizable === true) {
      return { column, handle: { key: next.key, label: next.label, direction: -1 as const } };
    }

    return { column, handle: null };
  }),
);

type ResizeHandle = NonNullable<(typeof headings.value)[number]['handle']>;

const visibleTracks = computed(() => props.tracks.slice(range.value.start, range.value.end));
const topSpacerHeight = computed(() => range.value.offsetTop);
const bottomSpacerHeight = computed(() =>
  Math.max(
    0,
    range.value.totalHeight - range.value.offsetTop - visibleTracks.value.length * rowHeight.value,
  ),
);
const tableColumnCount = computed(() => columns.value.length + 1);

const gridStyle = computed(() => ({
  '--library_grid_columns': tableGridTemplate(columns.value),
  '--library_row_height': `${rowHeight.value}px`,
  '--library_cover_size': `${coverColumnWidth.value}px`,
}));

const columnLabels = computed<Record<TableColumnKey, string>>(
  () =>
    Object.fromEntries(
      TABLE_COLUMN_KEYS.map((key) => [key, t(`library.columns.${key}`)]),
    ) as Record<TableColumnKey, string>,
);

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

  settings.setTableColumnWidth(
    resize.key,
    resize.startWidth + resize.direction * Math.round(event.clientX - resize.startX),
  );
}

function startResize(event: PointerEvent, handle: ResizeHandle) {
  const width = columns.value.find((column) => column.key === handle.key)?.width;

  if (width === undefined) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  resizing.value = {
    key: handle.key,
    direction: handle.direction,
    startX: event.clientX,
    startWidth: width,
  };
  document.addEventListener('pointermove', resizeColumn);
  document.addEventListener('pointerup', stopResize);
}

async function fitColumnsToContent() {
  await settings.setTableColumnWidths(
    fittedTableColumnWidths(settings.tableColumns, props.tracks, columnLabels.value),
  );
}

onMounted(() => measure(viewport.value));
onUnmounted(stopResize);
</script>

<template>
  <div class="library_table" :style="gridStyle">
    <div ref="viewport" class="library_table_scroller" @scroll="onScroll">
      <table class="library_table_grid" :aria-rowcount="tracks.length">
        <thead class="library_table_head">
          <tr class="library_table_head_row">
            <th
              v-for="{ column, handle } in headings"
              :key="column.key"
              class="library_table_heading"
              scope="col"
              :aria-sort="column.sortable ? ariaSort(column.key) : undefined"
            >
              <button
                v-if="column.sortable"
                class="library_table_sort"
                :class="{ library_table_sort_active: column.active }"
                type="button"
                :aria-label="t('library.sort.sortBy', { column: column.label })"
                :title="t('library.sort.sortBy', { column: column.label })"
                @click="sortColumn(column.key)"
              >
                <span class="library_table_sort_label">{{ column.label }}</span>
                <AppIcon
                  v-if="column.active"
                  :name="sort.direction === 'asc' ? 'sortAsc' : 'sortDesc'"
                />
              </button>
              <span v-else class="library_table_label" :title="column.label">{{
                column.label
              }}</span>
              <hr
                v-if="handle !== null"
                class="library_table_resize"
                :class="{ library_table_resize_active: resizing?.key === handle.key }"
                :aria-label="t('library.columns.resize', { column: handle.label })"
                :title="t('library.columns.resize', { column: handle.label })"
                aria-orientation="vertical"
                @pointerdown="startResize($event, handle)"
              />
            </th>
            <th
              class="library_table_heading library_table_heading_actions"
              scope="col"
              :aria-label="t('library.columns.actions')"
            >
              <AppTooltip v-if="showColumnSettings" :text="t('library.columnSettings.fit')">
                <button
                  class="library_table_tool"
                  type="button"
                  :aria-label="t('library.columnSettings.fit')"
                  data-testid="table-fit-columns"
                  @click="fitColumnsToContent"
                >
                  <AppIcon name="maximize" />
                </button>
              </AppTooltip>
              <AppTooltip v-if="showColumnSettings" :text="t('library.columnSettings.open')">
                <button
                  class="library_table_tool"
                  type="button"
                  :aria-label="t('library.columnSettings.open')"
                  data-testid="table-column-settings"
                  @click="isColumnSettingsOpen = true"
                >
                  <AppIcon name="settings" />
                </button>
              </AppTooltip>
            </th>
          </tr>
        </thead>

        <tbody class="library_table_viewport">
          <!-- Scroll height for the rows kept out of the DOM, empty of any content. -->
          <tr v-if="topSpacerHeight > 0" class="library_table_spacer_row">
            <td
              class="library_table_spacer"
              :colspan="tableColumnCount"
              :style="{ height: `${topSpacerHeight}px` }"
            />
          </tr>
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
          />
          <tr v-if="bottomSpacerHeight > 0" class="library_table_spacer_row">
            <td
              class="library_table_spacer"
              :colspan="tableColumnCount"
              :style="{ height: `${bottomSpacerHeight}px` }"
            />
          </tr>
        </tbody>
      </table>
    </div>

    <LibraryColumnSettingsDialog
      :open="isColumnSettingsOpen"
      @close="isColumnSettingsOpen = false"
    />
  </div>
</template>

<style scoped lang="scss">
.library_table {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  @include glass_surface($radius_lg);

  // One scrolling box for the head and the rows: reserving the scrollbar gutter twice is
  // what used to leave the headings a scrollbar out of line with their columns, and what
  // put a sideways bar under a table that fitted.
  &_scroller {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow-x: hidden;

    @include scroll_area;
  }

  // `flex: 1` would mean `flex-basis: 0`, which makes this box as tall as the scroller
  // rather than as tall as its rows — and a sticky head only sticks inside its own box, so
  // it would scroll away after one screenful. Growing from `auto` keeps both: the head
  // stays for the whole list, and a short list still fills the panel.
  &_grid {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    min-width: 100%;
    border-collapse: collapse;
  }

  &_head {
    display: block;
    position: sticky;
    top: 0;
    z-index: 3;
    border-bottom: 1px solid var(--color_border_strong);
    background-color: var(--table_head_background);
    color: var(--color_text_muted);
    font-size: 0.875em;
  }

  &_head_row {
    display: grid;
    grid-template-columns: var(--library_grid_columns);
    gap: $space_sm;
    align-items: center;
    padding: $space_sm $space_md;
  }

  // Not clipped. The grab handle straddles the edge of the heading, so hiding what falls
  // outside would leave only its inner half to aim at — which is what made the resize feel
  // broken. The label inside trims itself instead.
  &_heading {
    position: relative;
    padding: 0;
    text-align: left;
    white-space: nowrap;

    &_actions {
      display: flex;
      grid-column: -1;
      position: sticky;
      right: 0;
      z-index: 2;
      width: 5.25rem;
      gap: $space_xs;
      justify-self: end;
      justify-content: flex-end;
      background-color: var(--table_head_background);
      overflow: visible;
    }
  }

  &_label {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &_sort {
    display: inline-flex;
    gap: $space_xs;
    align-items: center;
    max-width: 100%;
    min-width: 0;
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

    &_label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @include focus_ring;
  }

  &_resize {
    position: absolute;
    top: 0;
    right: calc(#{$space_md} / -2);
    bottom: 0;
    width: $space_md;
    height: auto;
    margin: 0;
    border: 0;
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
    &:focus-visible::after,
    &_active::before,
    &_active::after {
      opacity: 1;
      background-color: var(--color_accent);
    }
  }

  &_tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--color_border);
    border-radius: $radius_md;
    background-color: var(--color_surface);
    color: var(--color_text_muted);
    font-size: 1.05rem;
    cursor: pointer;
    transition:
      background-color $duration_fast ease,
      border-color $duration_fast ease,
      color $duration_fast ease;

    &:hover {
      border-color: var(--color_accent);
      background-color: var(--color_accent_soft);
      color: var(--color_accent);
    }

    @include focus_ring;
  }

  &_viewport {
    display: block;
    min-height: 0;
  }

  &_spacer {
    padding: 0;
    border: 0;
  }
}

// A window too narrow for the columns it was asked to show: the grid keeps its widths and
// the table is scrolled sideways rather than squeezing everything out of shape.
@media (max-width: 760px) {
  .library_table_scroller {
    overflow-x: auto;
  }
}
</style>
