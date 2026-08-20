import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';

import LibraryFacetList from './LibraryFacetList.vue';

beforeEach(() => {
  resetI18n();
});

describe('LibraryFacetList', () => {
  it('groups tracks by artist with count and duration in list view', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        viewMode: 'table',
        tracks: [
          makeTrack({ title: 'Uno', artist: 'Artist B', album: 'Album B', durationMs: 120_000 }),
          makeTrack({ title: 'Due', artist: 'Artist A', album: 'Album A', durationMs: 60_000 }),
          makeTrack({ title: 'Tre', artist: 'Artist B', album: 'Album C', durationMs: 180_000 }),
        ],
      },
    });

    const rows = wrapper.findAll('.library_facet_list_row');

    expect(rows).toHaveLength(2);
    expect(wrapper.findAll('.library_facet_list_heading').map((heading) => heading.text())).toEqual(
      ['Autore', 'Album', 'Brani', 'Durata'],
    );
    expect(rows[0]?.text()).toContain('Artist A');
    expect(rows[0]?.text()).toContain('1 album');
    expect(rows[0]?.text()).toContain('1 brano');
    expect(rows[0]?.text()).toContain('1:00');
    expect(rows[1]?.text()).toContain('Artist B');
    expect(rows[1]?.text()).toContain('2 album');
    expect(rows[1]?.text()).toContain('2 brani');
    expect(rows[1]?.text()).toContain('5:00');
    expect(rows[1]?.text()).not.toContain('Uno, Tre');
  });

  it('shows groups as preview cards', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'album',
        viewMode: 'preview',
        tracks: [
          makeTrack({ title: 'Blue', album: 'Kind of Blue', durationMs: 60_000 }),
          makeTrack({ title: 'Green', album: 'Kind of Blue', durationMs: 120_000 }),
        ],
      },
    });

    expect(wrapper.find('.library_facet_list').exists()).toBe(false);
    expect(wrapper.findAll('.library_facet_card')).toHaveLength(1);
    expect(wrapper.find('.library_facet_card_label').exists()).toBe(false);
    expect(wrapper.find('.library_facet_card_cover.cover_image').exists()).toBe(true);
    expect(wrapper.get('.library_facet_card_title').text()).toBe('Kind of Blue');
    expect(wrapper.get('.library_facet_card').text()).toContain('2 brani');
    expect(wrapper.text()).not.toContain('Blue, Green');
  });

  it('uses wider and shorter preview cards for genres', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'genre',
        viewMode: 'preview',
        tracks: [
          makeTrack({ genre: 'Jazz', album: 'Album A', hasCover: true }),
          makeTrack({ genre: 'Jazz', album: 'Album B' }),
        ],
      },
    });

    const card = wrapper.get('.library_facet_card');

    expect(card.classes()).toContain('library_facet_card_genre');
    expect(wrapper.find('.library_facet_card_label').exists()).toBe(false);
    expect(wrapper.find('.library_facet_card_cover_mosaic').exists()).toBe(true);
    expect(card.text()).toContain('2 album');
    expect(card.text()).toContain('2 brani');
  });

  it('shows a cover mosaic for artist previews without repeating the field label', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        viewMode: 'preview',
        tracks: [
          makeTrack({ artist: 'Artist A', album: 'Album A', hasCover: true }),
          makeTrack({ artist: 'Artist A', album: 'Album B' }),
        ],
      },
    });

    expect(wrapper.get('.library_facet_card').classes()).toContain('library_facet_card_artist');
    expect(wrapper.find('.library_facet_card_label').exists()).toBe(false);
    expect(wrapper.find('.library_facet_card_cover_mosaic').exists()).toBe(true);
    expect(wrapper.get('.library_facet_card').text()).toContain('2 album');
  });

  it('shows the artist on album groups', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'album',
        viewMode: 'preview',
        tracks: [
          makeTrack({ artist: 'Miles Davis', album: 'Kind of Blue' }),
          makeTrack({ artist: 'Miles Davis', album: 'Kind of Blue' }),
        ],
      },
    });

    expect(wrapper.text()).toContain('Autore: Miles Davis');
  });

  it('opens the selected group from a card', async () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        viewMode: 'preview',
        tracks: [makeTrack({ artist: 'Artist A' })],
      },
    });

    await wrapper.get('.library_facet_card').trigger('click');

    expect(wrapper.emitted('open')).toEqual([
      [{ field: 'artist', key: 'Artist A', name: 'Artist A' }],
    ]);
  });

  it('opens the selected group from a row', async () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        viewMode: 'table',
        tracks: [makeTrack({ artist: 'Artist A' })],
      },
    });

    await wrapper.get('.library_facet_list_row').trigger('keydown.enter');

    expect(wrapper.emitted('open')).toEqual([
      [{ field: 'artist', key: 'Artist A', name: 'Artist A' }],
    ]);
  });

  it('puts missing values at the bottom with a readable label', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'genre',
        viewMode: 'table',
        tracks: [makeTrack({ genre: null }), makeTrack({ genre: 'Jazz' })],
      },
    });

    const rows = wrapper.findAll('.library_facet_list_row');

    expect(rows[0]?.text()).toContain('Jazz');
    expect(rows[1]?.text()).toContain('Senza genere');
  });
});
