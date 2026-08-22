import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack, makeTracks } from '@tests/support/tracks';
import { useSettingsStore } from '@/stores/settings';
import { DEFAULT_SORT, type SortState, type TrackView } from '@/types/library';

import LibraryColumnSettingsDialog from '@/components/library/LibraryColumnSettingsDialog.vue';
import LibraryTable from '@/components/library/LibraryTable.vue';

beforeEach(() => {
  resetI18n();
});

function mountTable(
  tracks: TrackView[],
  sort: SortState = DEFAULT_SORT,
  playingId: string | null = null,
) {
  return mount(LibraryTable, {
    ...withPinia(),
    props: { tracks, sort, selectedIds: [], playingId },
  });
}

function reservedListHeight(wrapper: ReturnType<typeof mountTable>, rowHeight: number) {
  const spacerHeight = wrapper.findAll('.library_table_spacer').reduce((total, spacer) => {
    const height = Number.parseInt(
      spacer.attributes('style')?.match(/height:\s*(\d+)px/)?.[1] ?? '0',
      10,
    );

    return total + height;
  }, 0);

  return spacerHeight + wrapper.findAll('.library_row').length * rowHeight;
}

describe('LibraryTable', () => {
  it('exposes the requested column headers', () => {
    const headings = mountTable([makeTrack()])
      .findAll('.library_table_heading')
      // The active column also renders the sort arrow.
      .map((heading) => heading.text().replace(/[▲▼]/u, '').trim());

    expect(headings).toEqual([
      'Copertina',
      'Nome',
      'Autore',
      'Album',
      'Anno',
      'Genere',
      'Durata',
      '▢⚙',
    ]);
  });

  it('declares the row count', () => {
    const wrapper = mountTable(makeTracks(3));

    expect(wrapper.get('table').attributes('aria-rowcount')).toBe('3');
  });

  it('requests sorting on header click, duration included', async () => {
    const wrapper = mountTable([makeTrack()]);

    await wrapper.findAll('.library_table_sort')[1]?.trigger('click');
    await wrapper.findAll('.library_table_sort').at(-1)?.trigger('click');

    expect(wrapper.emitted('sort')).toEqual([['artist'], ['duration']]);
  });

  it('uses the saved column visibility and widths', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    await settings.setTableColumnVisible('artist', false);
    await settings.setTableColumnVisible('format', true);
    await settings.setTableColumnWidth('title', 320);

    const wrapper = mount(LibraryTable, {
      ...options,
      props: {
        tracks: [makeTrack({ format: 'flac' })],
        sort: DEFAULT_SORT,
        selectedIds: [],
        playingId: null,
      },
    });
    const headings = wrapper
      .findAll('.library_table_heading')
      .map((heading) => heading.text().replace(/[▲▼]/u, '').trim());

    expect(headings).toContain('Formato');
    expect(headings).not.toContain('Autore');
    // The title takes the room the other columns leave, so its width is not a track of
    // its own: what the settings hold is read on the columns beside it.
    expect(wrapper.attributes('style')).toContain('minmax(6rem, 1fr)');
    expect(wrapper.attributes('style')).toContain('90px');
    expect(wrapper.text()).toContain('FLAC');
  });

  it('lists a fixed set of columns for contextual tables, whatever the settings hold', async () => {
    const options = withPinia();
    const settings = useSettingsStore();

    await settings.setTableColumnVisible('album', false);

    const wrapper = mount(LibraryTable, {
      ...options,
      props: {
        tracks: [makeTrack({ artist: 'Artist A', album: 'Album A', genre: 'Jazz' })],
        sort: DEFAULT_SORT,
        selectedIds: [],
        playingId: null,
        columnKeys: ['cover', 'title', 'artist', 'album', 'year', 'duration'],
        showColumnSettings: false,
      },
    });
    const headings = wrapper
      .findAll('.library_table_heading')
      .map((heading) => heading.text().replace(/[▲▼]/u, '').trim());

    // The album column is hidden in the settings, yet the contextual table still asks for it.
    expect(headings).toContain('Album');
    expect(headings).not.toContain('Genere');
    expect(wrapper.find('[data-testid="table-column-settings"]').exists()).toBe(false);
    expect(settings.tableColumns.find((column) => column.key === 'album')?.visible).toBe(false);
  });

  it('opens column settings from the fixed actions header', async () => {
    const wrapper = mountTable([makeTrack()]);

    await wrapper.get('[data-testid="table-column-settings"]').trigger('click');

    expect(wrapper.getComponent(LibraryColumnSettingsDialog).props('open')).toBe(true);
  });

  it('fits table columns from the fixed actions header', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(LibraryTable, {
      ...options,
      props: {
        tracks: [
          makeTrack({
            title:
              'A very long track title that should make the title column wider than the default',
          }),
        ],
        sort: DEFAULT_SORT,
        selectedIds: [],
        playingId: null,
      },
    });

    await wrapper.get('[data-testid="table-fit-columns"]').trigger('click');

    expect(settings.tableColumns.find((column) => column.key === 'title')?.width).toBeGreaterThan(
      260,
    );
  });

  it('shows resize handles only on resizable data columns', () => {
    const wrapper = mountTable([makeTrack()]);
    const headings = wrapper.findAll('.library_table_heading');
    const yearHeading = headings.find((heading) => heading.text().includes('Anno'));
    const durationHeading = headings.find((heading) => heading.text().includes('Durata'));

    expect(wrapper.findAll('.library_table_resize')).toHaveLength(5);
    expect(yearHeading?.find('.library_table_resize').exists()).toBe(false);
    expect(durationHeading?.find('.library_table_resize').exists()).toBe(false);
    expect(wrapper.find('.library_table_heading_actions .library_table_resize').exists()).toBe(
      false,
    );
    expect(wrapper.attributes('style')).toContain('4.5rem');
    expect(wrapper.attributes('style')).toContain('5.25rem 5.25rem');
    expect(wrapper.attributes('style')).not.toContain('minmax(0, 1fr) 2rem');
  });

  it('keeps the head and the rows in one scrolling box, so they cannot drift apart', () => {
    const wrapper = mountTable([makeTrack()]);

    // The head rides inside the scroller as a sticky row: reserving the scrollbar gutter
    // twice is what used to leave the headings out of line and a sideways bar under a
    // table that fitted.
    expect(wrapper.get('.library_table_scroller').element).toBe(
      wrapper.get('.library_table_head').element.parentElement?.parentElement,
    );
  });

  it('uses the saved column order', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    await settings.moveTableColumn('genre', 'artist');

    const wrapper = mount(LibraryTable, {
      ...options,
      props: { tracks: [makeTrack()], sort: DEFAULT_SORT, selectedIds: [], playingId: null },
    });
    const headings = wrapper
      .findAll('.library_table_heading')
      .map((heading) => heading.text().replace(/[▲▼]/u, '').trim());

    expect(headings.slice(0, 5)).toEqual(['Copertina', 'Nome', 'Genere', 'Autore', 'Album']);
  });

  it('marks the active column for screen readers', () => {
    const wrapper = mountTable([makeTrack()], { column: 'year', direction: 'desc' });
    const headers = wrapper.findAll('.library_table_heading');

    expect(headers[4]?.attributes('aria-sort')).toBe('descending');
    expect(headers[3]?.attributes('aria-sort')).toBe('none');
  });

  it('renders only a window of rows for long lists', () => {
    const wrapper = mountTable(makeTracks(500));

    const rendered = wrapper.findAll('.library_row').length;

    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(500);
  });

  it('marks only the playing row', () => {
    const tracks = makeTracks(3);
    const wrapper = mountTable(tracks, DEFAULT_SORT, tracks[1]?.id ?? null);

    const playing = wrapper.findAll('.library_row_playing');

    expect(playing).toHaveLength(1);
    expect(playing[0]?.text()).toContain(tracks[1]?.title);
  });

  it('reserves vertical space for the whole list', () => {
    const wrapper = mountTable(makeTracks(100));

    expect(reservedListHeight(wrapper, 56)).toBe(5600);
  });

  it('forwards row selection, edit, and removal', async () => {
    const track = makeTrack();
    const wrapper = mountTable([track]);

    await wrapper.get('.library_row').trigger('click');
    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[0]?.trigger('click');
    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[1]?.trigger('click');

    expect(wrapper.emitted('select')).toEqual([[{ id: track.id, additive: false, range: false }]]);
    expect(wrapper.emitted('edit')).toEqual([[track]]);
    expect(wrapper.emitted('remove')).toEqual([[track]]);
  });

  it('raises row height when text gets larger', async () => {
    document.documentElement.style.fontSize = '16px';
    const wrapper = mountTable(makeTracks(100));
    const settings = useSettingsStore();

    expect(reservedListHeight(wrapper, 56)).toBe(5600);

    document.documentElement.style.fontSize = '20px';
    settings.textSize = 'large';
    await wrapper.vm.$nextTick();

    expect(reservedListHeight(wrapper, 70)).toBe(7000);

    document.documentElement.style.removeProperty('font-size');
  });

  it('raises row height when the cover column is widened', async () => {
    document.documentElement.style.fontSize = '16px';
    const wrapper = mountTable(makeTracks(100));
    const settings = useSettingsStore();

    expect(wrapper.attributes('style')).toContain('--library_row_height: 56px');

    // 60 is as wide as the cover column goes.
    await settings.setTableColumnWidth('cover', 72);
    await wrapper.vm.$nextTick();

    // The rows and the windowing maths read the same value, so they cannot drift apart.
    expect(wrapper.attributes('style')).toContain('--library_row_height: 68px');
    expect(reservedListHeight(wrapper, 68)).toBe(6800);

    document.documentElement.style.removeProperty('font-size');
  });

  it('gives every contextual table the same cover, fixed to the row', async () => {
    document.documentElement.style.fontSize = '16px';
    const options = withPinia();
    const settings = useSettingsStore();
    await settings.setTableColumnWidth('cover', 60);

    const wrapper = mount(LibraryTable, {
      ...options,
      props: {
        tracks: [makeTrack()],
        sort: DEFAULT_SORT,
        selectedIds: [],
        playingId: null,
        columnKeys: ['cover', 'title', 'duration'],
        showColumnSettings: false,
      },
    });

    // The library setting is left out of it: the square fills the row, and only the text
    // size can move it.
    expect(wrapper.attributes('style')).toContain('--library_cover_size: 48px');
    expect(wrapper.attributes('style')).toContain('--library_row_height: 56px');
    expect(wrapper.find('.library_table_resize').exists()).toBe(false);

    document.documentElement.style.removeProperty('font-size');
  });

  it('leaves the row height alone while the cover still fits', async () => {
    document.documentElement.style.fontSize = '16px';
    const wrapper = mountTable(makeTracks(10));
    const settings = useSettingsStore();

    await settings.setTableColumnWidth('cover', 44);
    await wrapper.vm.$nextTick();

    expect(wrapper.attributes('style')).toContain('--library_row_height: 56px');

    document.documentElement.style.removeProperty('font-size');
  });

  it('leaves every other column alone when one is resized', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(LibraryTable, {
      ...options,
      props: { tracks: [makeTrack()], sort: DEFAULT_SORT, selectedIds: [], playingId: null },
    });

    const before = wrapper.attributes('style') ?? '';
    expect(before).toContain('4.5rem');

    await settings.setTableColumnWidth('album', 260);
    await wrapper.vm.$nextTick();

    const after = wrapper.attributes('style') ?? '';

    // Only the column that was dragged changes: the fixed ones keep their measure, the
    // actions keep theirs, and the title absorbs the difference.
    expect(after).toContain('260px');
    expect(after).toContain('4.5rem');
    expect(after).toContain('5.25rem 5.25rem');
    expect(after).toContain('minmax(6rem, 1fr)');
  });
});
