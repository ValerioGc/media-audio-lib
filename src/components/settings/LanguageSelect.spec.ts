import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { useSettingsStore } from '@/stores/settings';

import LanguageSelect from './LanguageSelect.vue';

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  localStorage.clear();
});

describe('LanguageSelect', () => {
  it('lists supported languages translated', () => {
    const wrapper = mount(LanguageSelect, withPinia());

    const labels = wrapper.findAll('option').map((option) => option.text());

    expect(labels).toEqual(['Italiano', 'Inglese']);
  });

  it('reflects the current store language', async () => {
    const wrapper = mount(LanguageSelect, withPinia());
    const store = useSettingsStore();

    await store.setLocale('en');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('select').element.value).toBe('en');
  });

  it('updates the store on selection', async () => {
    const wrapper = mount(LanguageSelect, withPinia());
    const store = useSettingsStore();

    await wrapper.get('select').setValue('en');

    expect(store.locale).toBe('en');
  });
});
