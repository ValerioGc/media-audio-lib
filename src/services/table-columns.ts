import { formatDuration } from '@/services/track-sorting';
import { SORTABLE_COLUMNS, type SortableColumn, type TrackView } from '@/types/library';
import {
  TABLE_COLUMN_WIDTHS,
  type TableColumnKey,
  type TableColumnSetting,
} from '@/types/settings';

const TABLE_ACTIONS_COLUMN_WIDTH = '5.25rem';
const FIXED_TABLE_COLUMN_WIDTHS: Partial<Record<TableColumnKey, string>> = {
  year: '4.5rem',
  duration: '5.25rem',
};
const CONTENT_CELL_PADDING_PX = 32;
const AVERAGE_CHARACTER_WIDTH_PX = 8;
const SAMPLE_LIMIT = 500;

export type TableGridMode = 'fit' | 'scroll';

export interface TableColumnView extends TableColumnSetting {
  label: string;
  sortable: boolean;
  resizable: boolean;
}

export function isSortableTableColumn(key: TableColumnKey): key is SortableColumn {
  return SORTABLE_COLUMNS.includes(key as SortableColumn);
}

export function visibleTableColumns(columns: readonly TableColumnSetting[]): TableColumnSetting[] {
  return columns.filter((column) => column.visible);
}

export function isResizableTableColumn(key: TableColumnKey): boolean {
  return FIXED_TABLE_COLUMN_WIDTHS[key] === undefined;
}

function clampColumnWidth(key: TableColumnKey, width: number): number {
  const limits = TABLE_COLUMN_WIDTHS[key];
  return Math.min(limits.max, Math.max(limits.min, width));
}

function estimateTextWidth(value: string): number {
  return Math.ceil(Array.from(value).length * AVERAGE_CHARACTER_WIDTH_PX + CONTENT_CELL_PADDING_PX);
}

function tableColumnContentValue(track: TrackView, key: TableColumnKey): string {
  return tableColumnValue(track, key, '', 'Missing', 'Present');
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

function tableColumnTrack(column: TableColumnSetting, mode: TableGridMode): string {
  const fixedWidth = FIXED_TABLE_COLUMN_WIDTHS[column.key];

  if (fixedWidth !== undefined) {
    return fixedWidth;
  }

  if (mode === 'fit') {
    return `minmax(0, ${column.width}fr)`;
  }

  return `minmax(${column.width}px, ${column.width}fr)`;
}

export function tableGridTemplate(
  columns: readonly TableColumnSetting[],
  mode: TableGridMode = 'scroll',
): string {
  const dataColumns = visibleTableColumns(columns).map((column) => tableColumnTrack(column, mode));

  return [...dataColumns, TABLE_ACTIONS_COLUMN_WIDTH].join(' ');
}

export function tableColumnValue(
  track: TrackView,
  key: TableColumnKey,
  unknown: string,
  missing: string,
  present: string,
): string {
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

  if (key === 'missing') {
    return track.missing ? missing : present;
  }

  return track[key] ?? unknown;
}
