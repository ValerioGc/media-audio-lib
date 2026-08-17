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
  it('elenca le lingue supportate tradotte', () => {
    const wrapper = mount(LanguageSelect, withPinia());

    const labels = wrapper.findAll('option').map((option) => option.text());

    expect(labels).toEqual(['Italiano', 'Inglese']);
  });

  it('riflette la lingua corrente dello store', async () => {
    const wrapper = mount(LanguageSelect, withPinia());
    const store = useSettingsStore();

    await store.setLocale('en');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('select').element.value).toBe('en');
  });

  it('aggiorna lo store alla selezione', async () => {
    const wrapper = mount(LanguageSelect, withPinia());
    const store = useSettingsStore();

    await wrapper.get('select').setValue('en');

    expect(store.locale).toBe('en');
  });
});
