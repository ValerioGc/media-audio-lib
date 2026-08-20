import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { useSettingsStore } from '@/stores/settings';

import CoverGradientToggle from './CoverGradientToggle.vue';

beforeEach(() => {
  resetI18n();
});

describe('CoverGradientToggle', () => {
  it('mostra lo stato salvato', () => {
    const options = withPinia();
    const settings = useSettingsStore();
    settings.coverGradientEnabled = false;

    const wrapper = mount(CoverGradientToggle, options);

    expect((wrapper.get('input').element as HTMLInputElement).checked).toBe(false);
  });

  it('aggiorna l impostazione', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const setCoverGradientEnabled = vi
      .spyOn(settings, 'setCoverGradientEnabled')
      .mockResolvedValue();

    const wrapper = mount(CoverGradientToggle, options);
    await wrapper.get('input').setValue(false);

    expect(setCoverGradientEnabled).toHaveBeenCalledWith(false);
  });

  it('aggiorna trasparenza e blur del player', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const setPlayerTransparency = vi.spyOn(settings, 'setPlayerTransparency').mockResolvedValue();
    const setPlayerBlur = vi.spyOn(settings, 'setPlayerBlur').mockResolvedValue();

    const wrapper = mount(CoverGradientToggle, options);
    await wrapper.get('[data-testid="player-transparency"]').setValue(30);
    await wrapper.get('[data-testid="player-blur"]').setValue(18);

    expect(setPlayerTransparency).toHaveBeenCalledWith(30);
    expect(setPlayerBlur).toHaveBeenCalledWith(18);
  });
});
