import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';
import { usePlayerStore } from '@/stores/player';

import LibraryRow from './LibraryRow.vue';

beforeEach(() => {
  resetI18n();
});

function mountRow(track = makeTrack(), selected = false, playing = false) {
  return mount(LibraryRow, { ...withPinia(), props: { track, selected, playing } });
}

describe('LibraryRow', () => {
  it('shows track fields in the columns', () => {
    const track = makeTrack({
      title: 'Track',
      artist: 'Artist',
      album: 'Album',
      year: 1999,
      genre: 'Jazz',
    });

    const cells = mountRow(track).findAll('[role="cell"]');

    expect(cells[1]?.text()).toContain('Track');
    expect(cells[2]?.text()).toBe('Artist');
    expect(cells[3]?.text()).toBe('Album');
    expect(cells[4]?.text()).toBe('1999');
    expect(cells[5]?.text()).toBe('Jazz');
  });

  it('shows a dash for missing fields', () => {
    const cells = mountRow(
      makeTrack({ artist: null, album: null, year: null, genre: null }),
    ).findAll('[role="cell"]');

    expect(cells[2]?.text()).toBe('—');
    expect(cells[3]?.text()).toBe('—');
    expect(cells[4]?.text()).toBe('—');
    expect(cells[5]?.text()).toBe('—');
  });

  it('formats duration', () => {
    const wrapper = mountRow(makeTrack({ durationMs: 185_000 }));

    expect(wrapper.get('.library_row_duration').text()).toBe('3:05');
  });

  it('reports files missing from disk', () => {
    const wrapper = mountRow(makeTrack({ missing: true }));

    expect(wrapper.classes()).toContain('library_row_missing');
    expect(wrapper.get('.library_row_badge').text()).toContain('File non più presente su disco');
    expect(wrapper.find('.library_row_badge .app_icon_warning').exists()).toBe(true);
  });

  it('highlights the selected row', () => {
    const wrapper = mountRow(makeTrack(), true);

    expect(wrapper.classes()).toContain('library_row_selected');
    expect(wrapper.attributes('aria-selected')).toBe('true');
  });

  it('marks the playing row', () => {
    const wrapper = mountRow(makeTrack(), false, true);

    expect(wrapper.classes()).toContain('library_row_playing');
    expect(wrapper.attributes('aria-current')).toBe('true');
    expect(wrapper.get('.library_row_badge_playing').text()).toContain('In riproduzione');
  });

  it('uses the cover gradient on the playing row', () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.setCoverAccent({
      rgb: '10 20 30',
      surfaceGradient: 'linear-gradient(red, transparent)',
      rowGradient: 'linear-gradient(90deg, rgb(10 20 30 / 26%), transparent)',
    });

    const wrapper = mount(LibraryRow, {
      ...options,
      props: { track: makeTrack(), selected: false, playing: true },
    });

    expect(wrapper.attributes('style')).toContain('--cover_row_gradient');
  });

  it('emits selection on click and Enter', async () => {
    const track = makeTrack();
    const wrapper = mountRow(track);

    await wrapper.trigger('click');
    await wrapper.trigger('keydown.enter');

    expect(wrapper.emitted('select')).toEqual([[track.id], [track.id]]);
  });

  it('emits removal without selecting the row', async () => {
    const track = makeTrack();
    const wrapper = mountRow(track);

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[2]?.trigger('click');

    expect(wrapper.emitted('remove')).toEqual([[track]]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('emits the metadata edit request', async () => {
    const track = makeTrack();
    const wrapper = mountRow(track);

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[0]?.trigger('click');

    expect(wrapper.emitted('edit')).toEqual([[track]]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('emits link verification', async () => {
    const track = makeTrack();
    const wrapper = mountRow(track);

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[1]?.trigger('click');

    expect(wrapper.emitted('verify')).toEqual([[track]]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('does not allow editing a missing file', async () => {
    const wrapper = mountRow(makeTrack({ missing: true }));

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');

    expect(wrapper.findAll('.library_row .app_menu_item')[0]?.attributes('disabled')).toBeDefined();
  });

  it('describes the menu to screen readers', async () => {
    const wrapper = mountRow(makeTrack({ title: 'Track' }));

    expect(wrapper.get('.library_row .app_menu_trigger').attributes('aria-label')).toBe(
      'Azioni per Track',
    );

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');

    expect(
      wrapper
        .findAll('.library_row .app_menu_item')
        .map((item) => item.get('.app_menu_item_label').text()),
    ).toEqual(['Modifica', 'Verifica', 'Elimina']);
    expect(
      wrapper.findAll('.library_row .app_menu_item').map((item) => item.attributes('aria-label')),
    ).toEqual([
      'Modifica i metadati di Track',
      'Verifica collegamento di Track',
      'Rimuovi Track dalla libreria',
    ]);
  });
});
