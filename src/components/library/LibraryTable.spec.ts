import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack, makeTracks } from '../../../tests/support/tracks';
import { DEFAULT_SORT, type SortState, type TrackView } from '@/types/library';

import LibraryTable from './LibraryTable.vue';

beforeEach(() => {
  resetI18n();
});

function mountTable(tracks: TrackView[], sort: SortState = DEFAULT_SORT) {
  return mount(LibraryTable, {
    ...withPinia(),
    props: { tracks, sort, selectedId: null },
  });
}

describe('LibraryTable', () => {
  it('espone le intestazioni delle colonne richieste', () => {
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

  it('dichiara il numero di righe', () => {
    const wrapper = mountTable(makeTracks(3));

    expect(wrapper.attributes('aria-rowcount')).toBe('3');
  });

  it('chiede l ordinamento al click sull intestazione', async () => {
    const wrapper = mountTable([makeTrack()]);

    await wrapper.findAll('.library_table_sort')[1]?.trigger('click');

    expect(wrapper.emitted('sort')).toEqual([['artist']]);
  });

  it('marca la colonna attiva per gli screen reader', () => {
    const wrapper = mountTable([makeTrack()], { column: 'year', direction: 'desc' });
    const headers = wrapper.findAll('[role="columnheader"]');

    expect(headers[4]?.attributes('aria-sort')).toBe('descending');
    expect(headers[3]?.attributes('aria-sort')).toBe('none');
  });

  it('rende solo una finestra di righe per liste lunghe', () => {
    const wrapper = mountTable(makeTracks(500));

    const rendered = wrapper.findAll('.library_row').length;

    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(500);
  });

  it('riserva lo spazio verticale dell intera lista', () => {
    const wrapper = mountTable(makeTracks(100));

    expect(wrapper.get('.library_table_spacer').attributes('style')).toContain('height: 5600px');
  });

  it('inoltra selezione, modifica, verifica e rimozione delle righe', async () => {
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
});
