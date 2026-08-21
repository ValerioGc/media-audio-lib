import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import * as bridge from '@/services/mini-player-bridge';
import * as shell from '@/services/shell-integration';
import { useSettingsStore } from '@/stores/settings';

import MiniPlayerView from '@/views/MiniPlayerView.vue';

const mocks = vi.hoisted(() => ({ state: vi.fn() }));

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
  mocks.state.mockReset();
});

/** The dock draws what the main window tells it: the listener is answered by hand here. */
async function mountDock() {
  const options = withPinia();
  const settings = useSettingsStore();
  vi.spyOn(bridge, 'onPlayerState').mockImplementation(async (run) => {
    mocks.state.mockImplementation(run);
    return null;
  });

  const wrapper = mount(MiniPlayerView, options);
  await flushPromises();
  // The dock reads the settings of the app on its own, browser language included.
  await settings.setLocale('it');
  await flushPromises();

  return { wrapper, settings };
}

describe('MiniPlayerView', () => {
  it('draws the track the main window is playing', async () => {
    const { wrapper } = await mountDock();

    expect(wrapper.get('.mini_player_title').text()).toBe('Nulla in riproduzione');

    mocks.state({
      title: 'Blue in Green',
      artist: 'Miles',
      cover: null,
      isPlaying: true,
      hasNext: true,
      hasPrevious: false,
    });
    await flushPromises();

    expect(wrapper.get('.mini_player_title').text()).toBe('Blue in Green');
    expect(wrapper.get('.mini_player_artist').text()).toBe('Miles');
    expect(wrapper.get('[data-testid="mini-toggle"]').attributes('aria-label')).toBe(
      'Metti in pausa',
    );
    expect(wrapper.get('[data-testid="mini-previous"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="mini-next"]').attributes('disabled')).toBeUndefined();
  });

  it('asks the main window for what only it can do', async () => {
    const send = vi.spyOn(bridge, 'sendMiniCommand').mockResolvedValue(true);
    const { wrapper } = await mountDock();

    await wrapper.get('[data-testid="mini-toggle"]').trigger('click');
    await wrapper.get('[data-testid="mini-stop"]').trigger('click');
    await wrapper.get('[data-testid="mini-expand"]').trigger('click');

    expect(send.mock.calls.map(([command]) => command)).toEqual(['toggle', 'stop', 'expand']);
  });

  it('turns the dock on its side and keeps it in front, from its own menu', async () => {
    const { wrapper, settings } = await mountDock();

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[0]?.trigger('click');

    expect(settings.miniPlayerOrientation).toBe('vertical');

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[1]?.trigger('click');

    expect(settings.miniPlayerAlwaysOnTop).toBe(false);
  });

  it('asks before closing, and can be told once and for all', async () => {
    const closeDock = vi.spyOn(shell, 'closeMiniPlayer').mockResolvedValue(true);
    const { wrapper, settings } = await mountDock();

    await wrapper.get('[data-testid="mini-close"]').trigger('click');
    expect(wrapper.find('dialog').exists()).toBe(true);

    await wrapper.get('[data-testid="mini-remember"]').setValue(true);
    await wrapper.get('[data-testid="mini-close-dock"]').trigger('click');
    await flushPromises();

    expect(closeDock).toHaveBeenCalledTimes(1);
    expect(settings.miniPlayerCloseAction).toBe('dock');
  });

  it('skips the question once the answer is remembered', async () => {
    const send = vi.spyOn(bridge, 'sendMiniCommand').mockResolvedValue(true);
    const { wrapper, settings } = await mountDock();
    settings.miniPlayerCloseAction = 'app';

    await wrapper.get('[data-testid="mini-close"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('dialog').exists()).toBe(false);
    expect(send).toHaveBeenCalledWith('quit');
  });
});
