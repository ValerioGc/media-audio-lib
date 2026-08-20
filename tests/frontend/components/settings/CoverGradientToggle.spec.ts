import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useSettingsStore } from '@/stores/settings';

import CoverGradientToggle from '@/components/settings/CoverGradientToggle.vue';

beforeEach(() => {
  resetI18n();
});

describe('CoverGradientToggle', () => {
  it('shows the saved state', () => {
    const options = withPinia();
    const settings = useSettingsStore();
    settings.coverGradientEnabled = false;

    const wrapper = mount(CoverGradientToggle, options);

    expect((wrapper.get('input').element as HTMLInputElement).checked).toBe(false);
  });

  it('updates the setting', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const setCoverGradientEnabled = vi
      .spyOn(settings, 'setCoverGradientEnabled')
      .mockResolvedValue();

    const wrapper = mount(CoverGradientToggle, options);
    await wrapper.get('input').setValue(false);

    expect(setCoverGradientEnabled).toHaveBeenCalledWith(false);
  });

  it('updates player transparency, gradient intensity and blur percentage', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const setPlayerTransparency = vi.spyOn(settings, 'setPlayerTransparency').mockResolvedValue();
    const setCoverGradientIntensity = vi
      .spyOn(settings, 'setCoverGradientIntensity')
      .mockResolvedValue();
    const setPlayerBlur = vi.spyOn(settings, 'setPlayerBlur').mockResolvedValue();

    const wrapper = mount(CoverGradientToggle, options);
    await wrapper.get('[data-testid="player-transparency"]').setValue(30);
    await wrapper.get('[data-testid="cover-gradient-intensity"]').setValue(160);
    await wrapper.get('[data-testid="player-blur"]').setValue(50);

    expect(setPlayerTransparency).toHaveBeenCalledWith(30);
    expect(setCoverGradientIntensity).toHaveBeenCalledWith(160);
    expect(setPlayerBlur).toHaveBeenCalledWith(14);
  });
});
