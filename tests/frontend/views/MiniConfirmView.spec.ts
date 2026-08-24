import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import * as shell from '@/services/shell-integration';
import * as windowControls from '@/services/window-controls';

import MiniConfirmView from '@/views/MiniConfirmView.vue';

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
});

describe('MiniConfirmView', () => {
  it('closes the dock directly when that choice is confirmed', async () => {
    const closeDock = vi.spyOn(shell, 'closeMiniPlayer').mockResolvedValue(true);
    const closeConfirmation = vi.spyOn(windowControls, 'closeWindow').mockResolvedValue(true);
    const wrapper = mount(MiniConfirmView, withPinia());

    await wrapper.get('[data-testid="mini-confirm-dock"]').trigger('click');

    expect(closeDock).toHaveBeenCalledTimes(1);
    expect(closeConfirmation).toHaveBeenCalledTimes(1);
  });

  it('quits the app directly when that choice is confirmed', async () => {
    const quit = vi.spyOn(windowControls, 'quitApp').mockResolvedValue(true);
    const closeConfirmation = vi.spyOn(windowControls, 'closeWindow').mockResolvedValue(true);
    const wrapper = mount(MiniConfirmView, withPinia());

    await wrapper.get('[data-testid="mini-confirm-app"]').trigger('click');

    expect(quit).toHaveBeenCalledTimes(1);
    expect(closeConfirmation).toHaveBeenCalledTimes(1);
  });
});
