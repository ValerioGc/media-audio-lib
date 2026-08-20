import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../tests/support/mount';
import { APP_NAME } from '@/config/app-config';
import { useNavigationStore } from '@/stores/navigation';
import { useSettingsStore } from '@/stores/settings';

import SettingsView from './SettingsView.vue';

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  localStorage.clear();
});

describe('SettingsView', () => {
  it('divide le impostazioni in generale e libreria', () => {
    const wrapper = mount(SettingsView, withPinia());

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Generale',
      'Libreria',
    ]);
  });

  it('raccoglie lingua, testo e tema sotto la prima tab', () => {
    const wrapper = mount(SettingsView, withPinia());

    const titles = wrapper.findAll('.settings_section_title').map((title) => title.text());

    expect(titles).toEqual(['Lingua', 'Dimensione testo', 'Tema', 'Sfondo da copertina']);
  });

  it('mostra la rinomina nella tab libreria', async () => {
    const wrapper = mount(SettingsView, withPinia());

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.get('.settings_section_title').text()).toBe('Nome della libreria');
    expect(wrapper.find('.library_name_form').exists()).toBe(true);
  });

  it('mostra l elenco delle librerie nella tab libreria', async () => {
    const wrapper = mount(SettingsView, withPinia());

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.findAll('.settings_section_title').map((titolo) => titolo.text())).toEqual([
      'Nome della libreria',
      'Import / Export',
      'Librerie',
    ]);
    expect(wrapper.find('.import_export_panel').exists()).toBe(true);
    expect(wrapper.find('.library_list').exists()).toBe(true);
  });

  it('mostra nome, versione e collegamento al progetto in fondo', () => {
    const wrapper = mount(SettingsView, withPinia());

    expect(wrapper.get('.settings_footer_name').text()).toBe(APP_NAME);
    expect(wrapper.find('[data-testid="github-link"]').exists()).toBe(true);
  });

  it('traduce tab e sezioni quando cambia la lingua', async () => {
    const wrapper = mount(SettingsView, withPinia());
    const store = useSettingsStore();

    await store.setLocale('en');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.settings_view_title').text()).toBe('Settings');
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'General',
      'Library',
    ]);
    expect(wrapper.findAll('.settings_section_title').map((title) => title.text())).toEqual([
      'Language',
      'Text size',
      'Theme',
      'Cover background',
    ]);
  });

  it('riporta alla libreria', async () => {
    const options = withPinia();
    const navigation = useNavigationStore();
    navigation.go('settings');
    const wrapper = mount(SettingsView, options);

    await wrapper.get('[data-testid="back-to-library"]').trigger('click');

    expect(navigation.view).toBe('library');
  });
});
