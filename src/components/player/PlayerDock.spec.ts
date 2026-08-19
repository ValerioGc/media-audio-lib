import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';
import { usePlayerStore } from '@/stores/player';

import PlayerDock from './PlayerDock.vue';

beforeEach(() => {
  resetI18n();
});

describe('PlayerDock', () => {
  it('resta invisibile finche non si riproduce nulla', () => {
    const wrapper = mount(PlayerDock, withPinia());

    expect(wrapper.find('.player_bar').exists()).toBe(false);
    expect(wrapper.find('.player_full').exists()).toBe(false);
  });

  it('mostra la barra in basso quando parte un brano', async () => {
    const options = withPinia();
    const player = usePlayerStore();

    const wrapper = mount(PlayerDock, options);
    player.play(makeTrack({ title: 'Brano', artist: 'Autore' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.player_bar_title').text()).toBe('Brano');
    expect(wrapper.get('.player_bar_artist').text()).toBe('Autore');
    expect(wrapper.find('.player_full').exists()).toBe(false);
  });

  it('passa a tutta pagina con la freccia e torna indietro', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.play(makeTrack({ title: 'Brano' }));

    const wrapper = mount(PlayerDock, options);
    await wrapper.get('[data-testid="player-expand"]').trigger('click');

    expect(player.isExpanded).toBe(true);
    expect(wrapper.get('.player_full_title').text()).toBe('Brano');
    expect(wrapper.find('.player_bar').exists()).toBe(false);

    await wrapper.get('[data-testid="player-collapse"]').trigger('click');

    expect(player.isExpanded).toBe(false);
    expect(wrapper.find('.player_bar').exists()).toBe(true);
  });

  it('chiude il player dalla barra', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.play(makeTrack());

    const wrapper = mount(PlayerDock, options);
    await wrapper.get('[data-testid="player-close"]').trigger('click');

    expect(player.isActive).toBe(false);
    expect(wrapper.find('.player_bar').exists()).toBe(false);
  });

  it('riduce la vista a tutta pagina con Escape', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.play(makeTrack());
    player.expand();

    const wrapper = mount(PlayerDock, { ...options, attachTo: document.body });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(player.isExpanded).toBe(false);
  });

  it('mostra autore e album anche quando mancano', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.play(makeTrack({ artist: null, album: null }));
    player.expand();

    const wrapper = mount(PlayerDock, options);

    expect(wrapper.findAll('.player_full_meta').map((meta) => meta.text())).toEqual(['—', '—']);
  });
});
