import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import * as defaultPlayer from '@/services/default-player';
import { useSettingsStore } from '@/stores/settings';

import DefaultPlayerBanner from '@/components/library/DefaultPlayerBanner.vue';

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
});

describe('DefaultPlayerBanner', () => {
  it('opens default app settings from the action button', async () => {
    const openSettings = vi
      .spyOn(defaultPlayer, 'openDefaultAudioPlayerSettings')
      .mockResolvedValue(true);
    const wrapper = mount(DefaultPlayerBanner, withPinia());

    await wrapper.get('.default_player_banner_actions button').trigger('click');

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('dismisses the banner through settings', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const dismiss = vi.spyOn(settings, 'dismissDefaultPlayerBanner').mockResolvedValue();
    const wrapper = mount(DefaultPlayerBanner, options);

    await wrapper.get('.default_player_banner_close').trigger('click');

    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('shows an error when system settings cannot be opened', async () => {
    vi.spyOn(defaultPlayer, 'openDefaultAudioPlayerSettings').mockResolvedValue(false);
    const wrapper = mount(DefaultPlayerBanner, withPinia());

    await wrapper.get('.default_player_banner_actions button').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Non riesco');
  });
});
