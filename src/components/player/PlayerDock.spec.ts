import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack, makeTracks } from '../../../tests/support/tracks';
import { usePlayerStore } from '@/stores/player';

const mocks = vi.hoisted(() => ({
  playbackUrl: vi.fn(),
  createAudioEngine: vi.fn(),
}));

vi.mock('@/services/playback-api', () => ({ playbackUrl: mocks.playbackUrl }));
vi.mock('@/services/audio-engine', () => ({ createAudioEngine: mocks.createAudioEngine }));

import PlayerDock from './PlayerDock.vue';

beforeEach(() => {
  resetI18n();
  mocks.playbackUrl.mockResolvedValue('asset://brano.mp3');
  mocks.createAudioEngine.mockReturnValue({
    load: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    release: vi.fn(),
  });
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

  it('mette titolo e autore sopra la copertina', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ title: 'Brano', artist: 'Autore' }));
    player.expand();

    const wrapper = mount(PlayerDock, options);
    const ordine = wrapper
      .findAll('.player_full_heading, .player_full_cover, .player_full_details')
      .map((blocco) => blocco.classes()[0]);

    expect(wrapper.get('.player_full_title').text()).toBe('Brano');
    expect(wrapper.get('.player_full_artist').text()).toBe('Autore');
    expect(ordine).toEqual(['player_full_heading', 'player_full_cover', 'player_full_details']);
  });

  it('elenca album, anno e genere sotto la copertina', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ album: 'Album', year: 2000, genre: 'Rock' }));
    player.expand();

    const wrapper = mount(PlayerDock, options);

    expect(wrapper.findAll('.player_full_detail_label').map((voce) => voce.text())).toEqual([
      'Album',
      'Anno',
      'Genere',
    ]);
    expect(wrapper.findAll('.player_full_detail_value').map((voce) => voce.text())).toEqual([
      'Album',
      '2000',
      'Rock',
    ]);
  });

  it('mostra un segnaposto per le informazioni mancanti', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ artist: null, album: null, year: null, genre: null }));
    player.expand();

    const wrapper = mount(PlayerDock, options);

    expect(wrapper.get('.player_full_artist').text()).toBe('—');
    expect(wrapper.findAll('.player_full_detail_value').map((voce) => voce.text())).toEqual([
      '—',
      '—',
      '—',
    ]);
  });

  it('comanda la riproduzione dalla barra', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    await player.playFrom(tracks, tracks[0]?.id ?? '');

    const wrapper = mount(PlayerDock, options);
    await wrapper.get('[data-testid="player-next"]').trigger('click');
    await flushPromises();

    expect(player.currentTrack?.id).toBe(tracks[1]?.id);
  });

  it('mostra tempo trascorso e durata del brano corrente', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ durationMs: 185_000 }));

    const wrapper = mount(PlayerDock, options);

    expect(wrapper.get('[data-testid="player-duration"]').text()).toBe('3:05');
    expect(wrapper.get('[data-testid="player-position"]').text()).toBe('0:00');
  });

  it('avvisa quando la riproduzione non parte', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ missing: true }));

    const wrapper = mount(PlayerDock, options);

    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Il file di questo brano non è più presente su disco.',
    );
  });
});
