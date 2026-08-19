import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack, makeTracks } from '../../../tests/support/tracks';
import type { TrackView } from '@/types/library';

import PreviewGrid from './PreviewGrid.vue';

beforeEach(() => {
  resetI18n();
});

function mountGrid(
  tracks: TrackView[],
  selectedId: string | null = null,
  playingId: string | null = null,
) {
  return mount(PreviewGrid, { ...withPinia(), props: { tracks, selectedId, playingId } });
}

describe('PreviewGrid', () => {
  it('rende una scheda per brano', () => {
    const wrapper = mountGrid(makeTracks(5));

    expect(wrapper.findAll('.preview_card')).toHaveLength(5);
    expect(wrapper.attributes('aria-rowcount')).toBe('5');
  });

  it('non rende nulla con una lista vuota', () => {
    const wrapper = mountGrid([]);

    expect(wrapper.findAll('.preview_card')).toHaveLength(0);
  });

  it('marca come selezionata solo la scheda corrente', () => {
    const tracks = makeTracks(3);
    const selectedTrack = tracks[1];
    const wrapper = mountGrid(tracks, selectedTrack?.id ?? null);

    const selected = wrapper.findAll('.preview_card_selected');

    expect(selected).toHaveLength(1);
    expect(selected[0]?.get('.preview_card_title').text()).toBe(selectedTrack?.title);
  });

  it('marca come in riproduzione solo la scheda corrente', () => {
    const tracks = makeTracks(3);
    const playingTrack = tracks[2];
    const wrapper = mountGrid(tracks, null, playingTrack?.id ?? null);

    const playing = wrapper.findAll('.preview_card_playing');

    expect(playing).toHaveLength(1);
    expect(playing[0]?.get('.preview_card_title').text()).toBe(playingTrack?.title);
  });

  it('inoltra selezione e azioni del menu', async () => {
    const track = makeTrack();
    const wrapper = mountGrid([track]);

    await wrapper.get('.preview_card').trigger('click');
    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[0]?.trigger('click');
    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[2]?.trigger('click');

    expect(wrapper.emitted('select')).toEqual([[track.id]]);
    expect(wrapper.emitted('edit')).toEqual([[track]]);
    expect(wrapper.emitted('remove')).toEqual([[track]]);
  });
});
