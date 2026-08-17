import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../tests/support/mount';
import { useSettingsStore } from '@/stores/settings';

import SettingsView from './SettingsView.vue';

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  localStorage.clear();
});

describe('SettingsView', () => {
  it('mostra le tre sezioni di impostazioni', () => {
    const wrapper = mount(SettingsView, withPinia());

    const titles = wrapper.findAll('.settings_section_title').map((title) => title.text());

    expect(titles).toEqual(['Lingua', 'Dimensione testo', 'Tema']);
  });

  it('traduce l intera vista quando cambia la lingua', async () => {
    const wrapper = mount(SettingsView, withPinia());
    const store = useSettingsStore();

    await store.setLocale('en');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.settings_view_title').text()).toBe('Settings');
    expect(wrapper.findAll('.settings_section_title').map((title) => title.text())).toEqual([
      'Language',
      'Text size',
      'Theme',
    ]);
  });
});
