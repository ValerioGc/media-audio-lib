import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack, makeTracks } from '../../../tests/support/tracks';
import { useSettingsStore } from '@/stores/settings';
import { DEFAULT_SORT, type SortState, type TrackView } from '@/types/library';

import LibraryTable from './LibraryTable.vue';

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
    props: { tracks, sort, selectedId: null, playingId },
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
      'Azioni',
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

    expect(wrapper.emitted('select')).toEqual([[track.id]]);
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
