import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import * as defaultPlayer from '@/services/default-player';

import DefaultPlayerPanel from './DefaultPlayerPanel.vue';

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
});

describe('DefaultPlayerPanel', () => {
  it('opens default app settings', async () => {
    const openSettings = vi
      .spyOn(defaultPlayer, 'openDefaultAudioPlayerSettings')
      .mockResolvedValue(true);
    const wrapper = mount(DefaultPlayerPanel, withPinia());

    await wrapper.get('button').trigger('click');

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('shows an error when system settings cannot be opened', async () => {
    vi.spyOn(defaultPlayer, 'openDefaultAudioPlayerSettings').mockResolvedValue(false);
    const wrapper = mount(DefaultPlayerPanel, withPinia());

    await wrapper.get('button').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[role="alert"]').text()).toContain('Non riesco');
  });
});
