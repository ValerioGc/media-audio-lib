import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';

import LibraryFacetList from './LibraryFacetList.vue';

beforeEach(() => {
  resetI18n();
});

describe('LibraryFacetList', () => {
  it('raggruppa i brani per autore con conteggio e durata', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        tracks: [
          makeTrack({ title: 'Uno', artist: 'Autore B', durationMs: 120_000 }),
          makeTrack({ title: 'Due', artist: 'Autore A', durationMs: 60_000 }),
          makeTrack({ title: 'Tre', artist: 'Autore B', durationMs: 180_000 }),
        ],
      },
    });

    const rows = wrapper.findAll('.library_facet_list_row');

    expect(rows).toHaveLength(2);
    expect(rows[0]?.text()).toContain('Autore A');
    expect(rows[0]?.text()).toContain('1 brano');
    expect(rows[0]?.text()).toContain('1:00');
    expect(rows[1]?.text()).toContain('Autore B');
    expect(rows[1]?.text()).toContain('2 brani');
    expect(rows[1]?.text()).toContain('5:00');
    expect(rows[1]?.text()).toContain('Uno, Tre');
  });

  it('mette i valori mancanti in fondo con una label leggibile', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'genre',
        tracks: [
          makeTrack({ genre: null }),
          makeTrack({ genre: 'Jazz' }),
        ],
      },
    });

    const rows = wrapper.findAll('.library_facet_list_row');

    expect(rows[0]?.text()).toContain('Jazz');
    expect(rows[1]?.text()).toContain('Senza genere');
  });
});
