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

describe('LibraryTable', () => {
  it('exposes the requested column headers', () => {
    const headings = mountTable([makeTrack()])
      .findAll('[role="columnheader"]')
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
      '⚙',
    ]);
  });

  it('declares the row count', () => {
    const wrapper = mountTable(makeTracks(3));

    expect(wrapper.attributes('aria-rowcount')).toBe('3');
  });

  it('requests sorting on header click', async () => {
    const wrapper = mountTable([makeTrack()]);

    await wrapper.findAll('.library_table_sort')[1]?.trigger('click');

    expect(wrapper.emitted('sort')).toEqual([['artist']]);
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
      .findAll('[role="columnheader"]')
      .map((heading) => heading.text().replace(/[▲▼]/u, '').trim());

    expect(headings).toContain('Formato');
    expect(headings).not.toContain('Autore');
    expect(wrapper.attributes('style')).toContain('320px');
    expect(wrapper.text()).toContain('FLAC');
  });

  it('can hide columns for contextual tables without changing user settings', () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(LibraryTable, {
      ...options,
      props: {
        tracks: [makeTrack({ artist: 'Artist A', genre: 'Jazz' })],
        sort: DEFAULT_SORT,
        selectedIds: [],
        playingId: null,
        hiddenColumnKeys: ['artist', 'genre'],
        showColumnSettings: false,
      },
    });
    const headings = wrapper
      .findAll('[role="columnheader"]')
      .map((heading) => heading.text().replace(/[▲▼]/u, '').trim());

    expect(headings).not.toContain('Autore');
    expect(headings).not.toContain('Genere');
    expect(wrapper.find('[data-testid="table-column-settings"]').exists()).toBe(false);
    expect(settings.tableColumns.find((column) => column.key === 'artist')?.visible).toBe(true);
  });

  it('opens column settings from the fixed actions header', async () => {
    const wrapper = mountTable([makeTrack()]);

    await wrapper.get('[data-testid="table-column-settings"]').trigger('click');

    expect(wrapper.getComponent(LibraryColumnSettingsDialog).props('open')).toBe(true);
  });

  it('shows a resize handle on data columns but not on the actions column', () => {
    const wrapper = mountTable([makeTrack()]);

    expect(wrapper.findAll('.library_table_resize')).toHaveLength(7);
    expect(wrapper.find('.library_table_heading_actions .library_table_resize').exists()).toBe(
      false,
    );
    expect(wrapper.attributes('style')).toContain('2.5rem');
  });

  it('enables horizontal scrolling only when requested', () => {
    const defaultTable = mountTable([makeTrack()]);
    const homepageTable = mount(LibraryTable, {
      ...withPinia(),
      props: {
        tracks: [makeTrack()],
        sort: DEFAULT_SORT,
        selectedIds: [],
        playingId: null,
        allowHorizontalScroll: true,
      },
    });

    expect(defaultTable.classes()).not.toContain('library_table_horizontal');
    expect(homepageTable.classes()).toContain('library_table_horizontal');
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
      .findAll('[role="columnheader"]')
      .map((heading) => heading.text().replace(/[▲▼]/u, '').trim());

    expect(headings.slice(0, 5)).toEqual(['Copertina', 'Nome', 'Genere', 'Autore', 'Album']);
  });

  it('marks the active column for screen readers', () => {
    const wrapper = mountTable([makeTrack()], { column: 'year', direction: 'desc' });
    const headers = wrapper.findAll('[role="columnheader"]');

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

    expect(wrapper.get('.library_table_spacer').attributes('style')).toContain('height: 5600px');
  });

  it('forwards row selection, edit, verify, and removal', async () => {
    const track = makeTrack();
    const wrapper = mountTable([track]);

    await wrapper.get('.library_row').trigger('click');
    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[0]?.trigger('click');
    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[1]?.trigger('click');
    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[2]?.trigger('click');

    expect(wrapper.emitted('select')).toEqual([[{ id: track.id, additive: false, range: false }]]);
    expect(wrapper.emitted('edit')).toEqual([[track]]);
    expect(wrapper.emitted('verify')).toEqual([[track]]);
    expect(wrapper.emitted('remove')).toEqual([[track]]);
  });

  it('raises row height when text gets larger', async () => {
    document.documentElement.style.fontSize = '16px';
    const wrapper = mountTable(makeTracks(100));
    const settings = useSettingsStore();

    expect(wrapper.get('.library_table_spacer').attributes('style')).toContain('height: 5600px');

    document.documentElement.style.fontSize = '20px';
    settings.textSize = 'large';
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.library_table_spacer').attributes('style')).toContain('height: 7000px');

    document.documentElement.style.removeProperty('font-size');
  });
});
