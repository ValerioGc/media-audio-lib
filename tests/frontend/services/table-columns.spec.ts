import { describe, expect, it } from 'vitest';

import {
  isLockedLeadingTableColumn,
  isMandatoryTableColumn,
  normalizeTableColumnOrder,
} from '@/services/table-columns';
import type { TableColumnSetting } from '@/types/settings';

function column(key: TableColumnSetting['key'], width = 100): TableColumnSetting {
  return { key, visible: true, width };
}

describe('isMandatoryTableColumn', () => {
  it('keeps cover, title and duration in the list whatever the settings say', () => {
    expect(isMandatoryTableColumn('cover')).toBe(true);
    expect(isMandatoryTableColumn('title')).toBe(true);
    expect(isMandatoryTableColumn('duration')).toBe(true);
  });

  it('leaves every other column free to be hidden', () => {
    for (const key of ['artist', 'album', 'year', 'genre', 'format', 'path'] as const) {
      expect(isMandatoryTableColumn(key)).toBe(false);
    }
  });
});

describe('isLockedLeadingTableColumn', () => {
  it('pins cover and title to the front', () => {
    expect(isLockedLeadingTableColumn('cover')).toBe(true);
    expect(isLockedLeadingTableColumn('title')).toBe(true);
  });

  it('lets the rest be moved, mandatory or not', () => {
    expect(isLockedLeadingTableColumn('duration')).toBe(false);
    expect(isLockedLeadingTableColumn('genre')).toBe(false);
  });
});

describe('normalizeTableColumnOrder', () => {
  it('brings the pinned columns back to the front, in their own order', () => {
    const order = normalizeTableColumnOrder([column('genre'), column('title'), column('cover')]);

    expect(order.map((item) => item.key)).toEqual(['cover', 'title', 'genre']);
  });

  it('leaves an order that is already right alone', () => {
    const order = normalizeTableColumnOrder([column('cover'), column('title'), column('album')]);

    expect(order.map((item) => item.key)).toEqual(['cover', 'title', 'album']);
  });

  it('keeps the order of everything that is not pinned', () => {
    const order = normalizeTableColumnOrder([
      column('year'),
      column('cover'),
      column('genre'),
      column('album'),
    ]);

    expect(order.map((item) => item.key)).toEqual(['cover', 'year', 'genre', 'album']);
  });

  it('copes with a pinned column that is not there at all', () => {
    const order = normalizeTableColumnOrder([column('album'), column('title')]);

    expect(order.map((item) => item.key)).toEqual(['title', 'album']);
  });

  it('carries the settings of each column through untouched', () => {
    const order = normalizeTableColumnOrder([{ key: 'genre', visible: false, width: 140 }]);

    expect(order[0]).toEqual({ key: 'genre', visible: false, width: 140 });
  });
});
