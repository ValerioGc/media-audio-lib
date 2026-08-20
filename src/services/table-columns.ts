import { formatDuration } from '@/services/track-sorting';
import { SORTABLE_COLUMNS, type SortableColumn, type TrackView } from '@/types/library';
import type { TableColumnKey, TableColumnSetting } from '@/types/settings';

const TABLE_ACTIONS_COLUMN_WIDTH = '2rem';
const FIXED_TABLE_COLUMN_WIDTHS: Partial<Record<TableColumnKey, string>> = {
  year: '4.5rem',
  duration: '5.25rem',
};

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
