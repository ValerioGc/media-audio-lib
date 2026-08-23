import { formatDuration } from '@/services/track-sorting';
import { SORTABLE_COLUMNS, type SortableColumn, type TrackView } from '@/types/library';
import {
  LOCKED_LEADING_TABLE_COLUMN_KEYS,
  MANDATORY_TABLE_COLUMN_KEYS,
  TABLE_COLUMN_WIDTHS,
  type TableColumnKey,
  type TableColumnSetting,
} from '@/types/settings';

const TABLE_ACTIONS_COLUMN_WIDTH = '5.25rem';
const FIXED_TABLE_COLUMN_WIDTHS: Partial<Record<TableColumnKey, string>> = {
  year: '4.5rem',
  duration: '5.25rem',
};

/** The column that takes whatever the others leave, so the table always fits its box. */
const FLEXIBLE_TABLE_COLUMN: TableColumnKey = 'title';
const CONTENT_CELL_PADDING_PX = 32;
const AVERAGE_CHARACTER_WIDTH_PX = 8;
const SAMPLE_LIMIT = 500;

export interface TableColumnView extends TableColumnSetting {
  label: string;
  sortable: boolean;
  resizable: boolean;
}

/** A column the list cannot do without: it stays visible whatever the settings say. */
export function isMandatoryTableColumn(key: TableColumnKey): boolean {
  return MANDATORY_TABLE_COLUMN_KEYS.includes(key as (typeof MANDATORY_TABLE_COLUMN_KEYS)[number]);
}

/** A column pinned to the front of the list: it cannot be moved out of its place. */
export function isLockedLeadingTableColumn(key: TableColumnKey): boolean {
  return LOCKED_LEADING_TABLE_COLUMN_KEYS.includes(
    key as (typeof LOCKED_LEADING_TABLE_COLUMN_KEYS)[number],
  );
}

/** Puts the pinned columns back at the front, whatever order the rest arrived in. */
export function normalizeTableColumnOrder(
  columns: readonly TableColumnSetting[],
): TableColumnSetting[] {
  const locked = LOCKED_LEADING_TABLE_COLUMN_KEYS.map((key) =>
    columns.find((column) => column.key === key),
  ).filter((column): column is TableColumnSetting => column !== undefined);
  const lockedKeys = new Set<TableColumnKey>(LOCKED_LEADING_TABLE_COLUMN_KEYS);

  return [...locked, ...columns.filter((column) => !lockedKeys.has(column.key))];
}

export function isSortableTableColumn(key: TableColumnKey): key is SortableColumn {
  return SORTABLE_COLUMNS.includes(key as SortableColumn);
}

export function visibleTableColumns(columns: readonly TableColumnSetting[]): TableColumnSetting[] {
  return columns.filter((column) => column.visible);
}

/**
 * Whether dragging can change the width of a column.
 *
 * Two kinds cannot. The fixed ones are a set number of characters — a year, a duration —
 * and nothing is gained by making them wider. The title is the one that stretches into
 * whatever the others leave: it has no width of its own, so a handle on it would move a
 * number the table never reads.
 */
export function isResizableTableColumn(key: TableColumnKey): boolean {
  return FIXED_TABLE_COLUMN_WIDTHS[key] === undefined && key !== FLEXIBLE_TABLE_COLUMN;
}

function clampColumnWidth(key: TableColumnKey, width: number): number {
  const limits = TABLE_COLUMN_WIDTHS[key];
  return Math.min(limits.max, Math.max(limits.min, width));
}

function estimateTextWidth(value: string): number {
  return Math.ceil(Array.from(value).length * AVERAGE_CHARACTER_WIDTH_PX + CONTENT_CELL_PADDING_PX);
}

function tableColumnContentValue(track: TrackView, key: TableColumnKey): string {
  return tableColumnValue(track, key, '');
}

export function fittedTableColumnWidths(
  columns: readonly TableColumnSetting[],
  tracks: readonly TrackView[],
  labels: Record<TableColumnKey, string>,
): Partial<Record<TableColumnKey, number>> {
  const sampledTracks = tracks.slice(0, SAMPLE_LIMIT);

  return Object.fromEntries(
    columns
      .filter((column) => isResizableTableColumn(column.key))
      .map((column) => {
        // The cover holds a picture, not words: fitting it to its content means the
        // narrowest it goes. Measuring the heading instead would size a square by the
        // length of the word above it.
        if (column.key === 'cover') {
          return [column.key, TABLE_COLUMN_WIDTHS.cover.min];
        }

        const contentWidths = sampledTracks.map((track) =>
          estimateTextWidth(tableColumnContentValue(track, column.key)),
        );
        const width = Math.max(
          TABLE_COLUMN_WIDTHS[column.key].default,
          estimateTextWidth(labels[column.key]),
          ...contentWidths,
        );

        return [column.key, clampColumnWidth(column.key, width)];
      }),
  );
}

/** The narrowest the title is allowed to get while it absorbs the free space. */
const MIN_TITLE_WIDTH = '6rem';

/**
 * The track of one column.
 *
 * Every column but the title keeps exactly the width it was given, so resizing one leaves
 * the others where they were — the fixed ones included. The title takes whatever is left,
 * which is what keeps the whole grid the width of the table: no sideways scroll, and the
 * actions never move from the right edge.
 */
/**
 * The columns that share the free space of a table shown inside a window, and how much of
 * it each one takes.
 *
 * On the page only the title stretches, because there is room enough for the rest to keep
 * the width the reader gave them. In a window there is not: leaving the whole of the free
 * space to the title pushes the album to the far side of it, a screen away from the name it
 * belongs to. They stretch together, the title twice as fast.
 */
const CONTEXTUAL_SHARES: Partial<Record<TableColumnKey, number>> = {
  title: 2,
  album: 1,
  artist: 1,
  genre: 1,
  path: 1,
};

function tableColumnTrack(column: TableColumnSetting, contextual: boolean): string {
  const fixedWidth = FIXED_TABLE_COLUMN_WIDTHS[column.key];

  if (fixedWidth !== undefined) {
    return fixedWidth;
  }

  const share = contextual ? CONTEXTUAL_SHARES[column.key] : undefined;

  if (share !== undefined) {
    return `minmax(${TABLE_COLUMN_WIDTHS[column.key].min}px, ${share}fr)`;
  }

  if (column.key === FLEXIBLE_TABLE_COLUMN) {
    return `minmax(${MIN_TITLE_WIDTH}, 1fr)`;
  }

  return `${column.width}px`;
}

export function tableGridTemplate(
  columns: readonly TableColumnSetting[],
  contextual = false,
): string {
  const dataColumns = visibleTableColumns(columns).map((column) =>
    tableColumnTrack(column, contextual),
  );

  return [...dataColumns, TABLE_ACTIONS_COLUMN_WIDTH].join(' ');
}

/**
 * The widths a table shown inside a window uses, rather than the ones of the main list.
 *
 * There is far less room in a window than on the page, and the column being read is the
 * name of the track: giving the others what they are given in the list leaves the name
 * cut short beside an album column half of which is empty. They keep their narrowest here,
 * and what is left over goes to the name.
 */
export function contextualColumnWidths(
  columns: readonly TableColumnSetting[],
): TableColumnSetting[] {
  return columns.map((column) => ({ ...column, width: TABLE_COLUMN_WIDTHS[column.key].min }));
}

export function tableColumnValue(track: TrackView, key: TableColumnKey, unknown: string): string {
  if (key === 'cover') {
    return '';
  }

  if (key === 'title') {
    return track.title;
  }

  if (key === 'duration') {
    return formatDuration(track.durationMs);
  }

  if (key === 'year') {
    return track.year === null ? unknown : String(track.year);
  }

  if (key === 'format') {
    return track.format.toUpperCase();
  }

  if (key === 'path') {
    return track.path;
  }

  return track[key] ?? unknown;
}
