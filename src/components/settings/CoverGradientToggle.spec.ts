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
});
