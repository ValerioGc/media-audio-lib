import { formatDuration } from '@/services/track-sorting';
import { SORTABLE_COLUMNS, type SortableColumn, type TrackView } from '@/types/library';
import type { TableColumnKey, TableColumnSetting } from '@/types/settings';

const TABLE_ACTIONS_COLUMN_WIDTH = '2.5rem';

export type TableGridMode = 'fit' | 'scroll';

export interface TableColumnView extends TableColumnSetting {
  label: string;
  sortable: boolean;
}

export function isSortableTableColumn(key: TableColumnKey): key is SortableColumn {
  return SORTABLE_COLUMNS.includes(key as SortableColumn);
}

export function visibleTableColumns(columns: readonly TableColumnSetting[]): TableColumnSetting[] {
  return columns.filter((column) => column.visible);
}

export function tableGridTemplate(
  columns: readonly TableColumnSetting[],
  mode: TableGridMode = 'scroll',
): string {
  const dataColumns = visibleTableColumns(columns).map((column) =>
    mode === 'fit' ? `minmax(0, ${column.width}fr)` : `${column.width}px`,
  );

  if (mode === 'fit') {
    return [...dataColumns, TABLE_ACTIONS_COLUMN_WIDTH].join(' ');
  }

  return [...dataColumns, 'minmax(0, 1fr)', TABLE_ACTIONS_COLUMN_WIDTH].join(' ');
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
