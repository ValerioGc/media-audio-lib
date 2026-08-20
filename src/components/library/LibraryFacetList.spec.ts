import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';

import LibraryFacetList from './LibraryFacetList.vue';

beforeEach(() => {
  resetI18n();
});

describe('LibraryFacetList', () => {
  it('groups tracks by artist with count and duration', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        tracks: [
          makeTrack({ title: 'Uno', artist: 'Artist B', durationMs: 120_000 }),
          makeTrack({ title: 'Due', artist: 'Artist A', durationMs: 60_000 }),
          makeTrack({ title: 'Tre', artist: 'Artist B', durationMs: 180_000 }),
        ],
      },
    });

    const rows = wrapper.findAll('.library_facet_list_row');

    expect(rows).toHaveLength(2);
    expect(rows[0]?.text()).toContain('Artist A');
    expect(rows[0]?.text()).toContain('1 brano');
    expect(rows[0]?.text()).toContain('1:00');
    expect(rows[1]?.text()).toContain('Artist B');
    expect(rows[1]?.text()).toContain('2 brani');
    expect(rows[1]?.text()).toContain('5:00');
    expect(rows[1]?.text()).toContain('Uno, Tre');
  });

  it('puts missing values at the bottom with a readable label', () => {
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
