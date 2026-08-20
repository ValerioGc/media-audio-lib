import { formatDuration } from '@/services/track-sorting';
import { SORTABLE_COLUMNS, type SortableColumn, type TrackView } from '@/types/library';
import type { TableColumnKey, TableColumnSetting } from '@/types/settings';

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

export function tableGridTemplate(columns: readonly TableColumnSetting[]): string {
  return [...visibleTableColumns(columns).map((column) => `${column.width}px`), '5.5rem'].join(' ');
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
