import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack, makeTracks } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';

const mocks = vi.hoisted(() => ({
  playbackUrl: vi.fn(),
  createAudioEngine: vi.fn(),
  dominantCoverAccent: vi.fn(),
}));

vi.mock('@/services/playback-api', () => ({ playbackUrl: mocks.playbackUrl }));
vi.mock('@/services/audio-engine', () => ({ createAudioEngine: mocks.createAudioEngine }));
vi.mock('@/services/cover-accent', () => ({ dominantCoverAccent: mocks.dominantCoverAccent }));

import PlayerDock from '@/components/player/PlayerDock.vue';

const wrappers: VueWrapper[] = [];

beforeEach(() => {
  resetI18n();
  vi.clearAllMocks();
  mocks.playbackUrl.mockResolvedValue('asset://track.mp3');
  mocks.createAudioEngine.mockReturnValue({
    load: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    release: vi.fn(),
  });
  mocks.dominantCoverAccent.mockResolvedValue({
    rgb: '10 20 30',
    surfaceGradient: 'linear-gradient(rgb(10 20 30 / 28%), transparent)',
    rowGradient: 'linear-gradient(90deg, rgb(10 20 30 / 26%), transparent)',
  });
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});

function mountDock(options: ReturnType<typeof withPinia> = withPinia(), attachTo?: HTMLElement) {
  const wrapper = mount(PlayerDock, {
    ...options,
    ...(attachTo === undefined ? {} : { attachTo }),
  });
  wrappers.push(wrapper);

  return wrapper;
}

describe('PlayerDock', () => {
  it('stays invisible until something plays', () => {
    const wrapper = mountDock();

    expect(wrapper.find('.player_bar').exists()).toBe(false);
    expect(wrapper.find('.player_full').exists()).toBe(false);
  });

  it('shows the bottom bar when a track starts', async () => {
    const options = withPinia();
    const player = usePlayerStore();

    const wrapper = mountDock(options);
    player.play(makeTrack({ title: 'Track', artist: 'Artist' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.player_bar_title').text()).toBe('Track');
    expect(wrapper.get('.player_bar_artist').text()).toBe('Artist');
    expect(wrapper.find('.player_full').exists()).toBe(false);
  });

  it('applies the cover gradient to the player', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const library = useLibraryStore();
    vi.spyOn(library, 'loadCover').mockResolvedValue('data:image/png;base64,AAA');
    await player.play(makeTrack({ hasCover: true }));

    const wrapper = mountDock(options);
    await flushPromises();

    expect(mocks.dominantCoverAccent).toHaveBeenCalledWith('data:image/png;base64,AAA', 100);
    expect(player.coverAccent?.rgb).toBe('10 20 30');
    expect(wrapper.get('.player_bar').classes()).toContain('player_bar_accented');
  });

  it('does not load the color when the gradient is disabled', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const settings = useSettingsStore();
    settings.coverGradientEnabled = false;
    player.setCoverAccent({
      rgb: '10 20 30',
      surfaceGradient: 'linear-gradient(red, transparent)',
      rowGradient: 'linear-gradient(red, transparent)',
    });
    await player.play(makeTrack({ hasCover: true }));

    mountDock(options);
    await flushPromises();

    expect(mocks.dominantCoverAccent).not.toHaveBeenCalled();
    expect(player.coverAccent).toBeNull();
  });

  it('switches to full page with the arrow and back', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.play(makeTrack({ title: 'Track' }));

    const wrapper = mountDock(options);
    await wrapper.get('[data-testid="player-expand"]').trigger('click');

    expect(player.isExpanded).toBe(true);
    expect(wrapper.get('.player_full_title').text()).toBe('Track');
    expect(wrapper.find('.player_bar').exists()).toBe(false);

    await wrapper.get('[data-testid="player-collapse"]').trigger('click');

    expect(player.isExpanded).toBe(false);
    expect(wrapper.find('.player_bar').exists()).toBe(true);
  });

  it('closes the player from the bar', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.play(makeTrack());

    const wrapper = mountDock(options);
    await wrapper.get('[data-testid="player-close"]').trigger('click');

    expect(player.isActive).toBe(false);
    expect(wrapper.find('.player_bar').exists()).toBe(false);
  });

  it('collapses the full page view with Escape', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.play(makeTrack());
    player.expand();

    const wrapper = mountDock(options, document.body);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(player.isExpanded).toBe(false);
  });

  it('puts title and artist above the cover', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ title: 'Track', artist: 'Artist' }));
    player.expand();

    const wrapper = mountDock(options);
    const ordine = wrapper
      .findAll('.player_full_heading, .player_full_cover, .player_full_details')
      .map((blocco) => blocco.classes()[0]);

    expect(wrapper.get('.player_full_title').text()).toBe('Track');
    expect(wrapper.get('.player_full_artist').text()).toBe('Artist');
    expect(ordine).toEqual(['player_full_heading', 'player_full_cover', 'player_full_details']);
  });

  it('lists album, year, and genre under the cover', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ album: 'Album', year: 2000, genre: 'Rock' }));
    player.expand();

    const wrapper = mountDock(options);

    expect(wrapper.findAll('.player_full_detail_label').map((item) => item.text())).toEqual([
      'Album',
      'Anno',
      'Genere',
    ]);
    expect(wrapper.findAll('.player_full_detail_value').map((item) => item.text())).toEqual([
      'Album',
      '2000',
      'Rock',
    ]);
  });

  it('shows a placeholder for missing information', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ artist: null, album: null, year: null, genre: null }));
    player.expand();

    const wrapper = mountDock(options);

    expect(wrapper.get('.player_full_artist').text()).toBe('—');
    expect(wrapper.findAll('.player_full_detail_value').map((item) => item.text())).toEqual([
      '—',
      '—',
      '—',
    ]);
  });

  it('controls playback from the bar', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    await player.playFrom(tracks, tracks[0]?.id ?? '');

    const wrapper = mountDock(options);
    await wrapper.get('[data-testid="player-next"]').trigger('click');
    await flushPromises();

    expect(player.currentTrack?.id).toBe(tracks[1]?.id);
  });

  it('shows elapsed time and current track duration', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ durationMs: 185_000 }));

    const wrapper = mountDock(options);

    expect(wrapper.get('[data-testid="player-duration"]').text()).toBe('3:05');
    expect(wrapper.get('[data-testid="player-position"]').text()).toBe('0:00');
  });

  it('warns when playback does not start', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ missing: true }));

    const wrapper = mountDock(options);

    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Il file di questo brano non è più presente su disco.',
    );
  });
});
