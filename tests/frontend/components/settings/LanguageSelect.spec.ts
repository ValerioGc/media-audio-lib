import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import flagGb from '@/assets/icons/flag-gb.svg';
import flagIt from '@/assets/icons/flag-it.svg';
import { useSettingsStore } from '@/stores/settings';

import LanguageSelect from '@/components/settings/LanguageSelect.vue';

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  localStorage.clear();
});

describe('LanguageSelect', () => {
  it('lists supported languages translated', () => {
    const wrapper = mount(LanguageSelect, withPinia());

    const labels = wrapper.findAll('.app_option_group_text').map((text) => text.text());

    expect(labels).toEqual(['Italiano', 'Inglese']);
  });

  it('shows the flag of each language before its name', () => {
    const wrapper = mount(LanguageSelect, withPinia());
    const flags = wrapper.findAll('.app_option_group_icon');

    // Vite inlines small SVGs as data URIs, so the mapping is checked against the assets
    // themselves rather than against a file name that does not survive the build.
    expect(flags).toHaveLength(2);
    expect(flags[0]?.attributes('src')).toBe(flagIt);
    expect(flags[1]?.attributes('src')).toBe(flagGb);
    expect(flagIt).not.toBe(flagGb);
    // The name beside it already says which language this is.
    expect(flags[0]?.attributes('alt')).toBe('');
  });

  it('reflects the current store language', async () => {
    const wrapper = mount(LanguageSelect, withPinia());
    const store = useSettingsStore();

    await store.setLocale('en');
    await wrapper.vm.$nextTick();

    const inputs = wrapper.findAll<HTMLInputElement>('input[type="radio"]');

    expect(inputs[1]?.element.checked).toBe(true);
    expect(wrapper.findAll('.app_option_group_item')[1]?.classes()).toContain(
      'app_option_group_item_selected',
    );
  });

  it('updates the store on selection', async () => {
    const wrapper = mount(LanguageSelect, withPinia());
    const store = useSettingsStore();

    await wrapper.findAll('input[type="radio"]')[1]?.setValue(true);

    expect(store.locale).toBe('en');
  });
});
