import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { ambience } from '@/services/ambience';
import { useSettingsStore } from '@/stores/settings';

import AmbienceToggle from '@/components/settings/AmbienceToggle.vue';

beforeEach(() => {
  resetI18n();
});

describe('AmbienceToggle', () => {
  it('shows both switches as on by default', () => {
    const wrapper = mount(AmbienceToggle, withPinia());

    expect(
      wrapper.get<HTMLInputElement>('[data-testid="ambient-background-toggle"]').element.checked,
    ).toBe(true);
    expect(
      wrapper.get<HTMLInputElement>('[data-testid="glass-surfaces-toggle"]').element.checked,
    ).toBe(true);
  });

  it('turns the background off without touching the glass', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(AmbienceToggle, options);

    await wrapper.get('[data-testid="ambient-background-toggle"]').setValue(false);

    expect(settings.ambientBackgroundEnabled).toBe(false);
    expect(settings.glassSurfacesEnabled).toBe(true);
  });

  it('turns the glass off without touching the background', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(AmbienceToggle, options);

    await wrapper.get('[data-testid="glass-surfaces-toggle"]').setValue(false);

    expect(settings.glassSurfacesEnabled).toBe(false);
    expect(settings.ambientBackgroundEnabled).toBe(true);
  });

  it('previews the background built from the accent in use', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    await settings.setAccentColor('#107c10');
    const wrapper = mount(AmbienceToggle, options);

    // The browser rewrites `rgb(r g b / n%)` as `rgba(...)`, so the colours are what the
    // assertion can hold on to.
    const style = wrapper.get('[data-testid="ambience-preview"]').attributes('style') ?? '';
    const { secondary } = ambience('#107c10', settings.resolvedTheme);

    expect(style).toContain('16, 124, 16');
    expect(secondary).toBe('#34107c');
    expect(style).toContain('52, 16, 124');
    expect(style).toContain('radial-gradient');
  });

  it('drops the preview when there is no background to show', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    await settings.setAmbientBackgroundEnabled(false);
    const wrapper = mount(AmbienceToggle, options);

    expect(wrapper.find('[data-testid="ambience-preview"]').exists()).toBe(false);
  });
});
