import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestPinia, resetI18n } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import { i18n } from '@/i18n';
import { useNavigationStore } from '@/stores/navigation';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';

const mocks = vi.hoisted(() => ({
  startupAudioFile: vi.fn(),
  playbackUrl: vi.fn(),
  createAudioEngine: vi.fn(),
}));

vi.mock('@/services/playback-api', () => ({
  startupAudioFile: mocks.startupAudioFile,
  playbackUrl: mocks.playbackUrl,
}));

vi.mock('@/services/audio-engine', () => ({
  createAudioEngine: mocks.createAudioEngine,
}));

import App from '@/App.vue';

beforeEach(() => {
  resetI18n();
  vi.clearAllMocks();
  mocks.startupAudioFile.mockResolvedValue(null);
  mocks.playbackUrl.mockResolvedValue('asset://track.mp3');
  mocks.createAudioEngine.mockReturnValue({
    load: vi.fn(),
    preload: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setTrackGain: vi.fn(),
    release: vi.fn(),
  });
  localStorage.setItem(
    'app-settings',
    JSON.stringify({ locale: 'it', textSize: 'medium', theme: 'light' }),
  );
});

afterEach(() => {
  localStorage.clear();
});

async function mountApp() {
  const wrapper = mount(App, { global: { plugins: [createTestPinia(), i18n] } });
  await flushPromises();

  return wrapper;
}

describe('App', () => {
  it('shows the custom titlebar instead of the system one', async () => {
    const wrapper = await mountApp();

    expect(wrapper.get('.titlebar_name').text()).toBe('Media Audio Lib');
    expect(wrapper.find('[data-testid="window-close"]').exists()).toBe(true);
  });

  it('starts on the library', async () => {
    const wrapper = await mountApp();

    expect(wrapper.find('.library_view').exists()).toBe(true);
    expect(wrapper.find('.settings_view').exists()).toBe(false);
  });

  it('opens settings from the titlebar icon', async () => {
    const wrapper = await mountApp();

    await wrapper.get('[data-testid="open-settings"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('.settings_view_title').text()).toBe('Impostazioni');
    expect(wrapper.find('.library_view').exists()).toBe(false);
  });

  it('returns to the library from the same icon', async () => {
    const wrapper = await mountApp();
    useNavigationStore().go('settings');
    await flushPromises();

    await wrapper.get('[data-testid="open-settings"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('.settings_view').exists()).toBe(false);
    expect(wrapper.find('.library_view').exists()).toBe(true);
  });

  it('shows the bottom player only when something is playing', async () => {
    const wrapper = await mountApp();

    expect(wrapper.find('.player_bar').exists()).toBe(false);

    usePlayerStore().play(makeTrack({ title: 'Track' }));
    await flushPromises();

    expect(wrapper.get('.player_bar_title').text()).toBe('Track');
  });

  it('opens a startup audio file in player-only mode', async () => {
    mocks.startupAudioFile.mockResolvedValue(makeTrack({ title: 'Direct file', standalone: true }));

    const wrapper = await mountApp();
    await flushPromises();

    expect(useNavigationStore().view).toBe('player');
    expect(wrapper.get('.player_full_title').text()).toBe('Direct file');
    expect(wrapper.get('[data-testid="open-library-from-player"]').text()).toContain(
      'Apri libreria',
    );

    await wrapper.get('[data-testid="open-library-from-player"]').trigger('click');
    await flushPromises();

    expect(useNavigationStore().view).toBe('library');
    expect(wrapper.find('.library_view').exists()).toBe(true);
  });

  it('releases the system theme listener on unmount', async () => {
    const wrapper = await mountApp();
    const dispose = vi.spyOn(useSettingsStore(), 'dispose');

    wrapper.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('applies saved settings to the document', async () => {
    await mountApp();

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.lang).toBe('it');
  });
});
