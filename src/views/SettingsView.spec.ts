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
  it('splits settings between general and library', () => {
    const wrapper = mount(SettingsView, withPinia());

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Generale',
      'Libreria',
    ]);
  });

  it('groups general application settings under the first tab', () => {
    const wrapper = mount(SettingsView, withPinia());

    const titles = wrapper.findAll('.settings_section_title').map((title) => title.text());

    expect(titles).toEqual([
      'Lingua',
      'Dimensione testo',
      'Tema',
      'Sfondo da copertina',
      'Player audio predefinito',
    ]);
  });

  it('does not show rename in the library tab', async () => {
    const wrapper = mount(SettingsView, withPinia());

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.findAll('.settings_section_title').map((title) => title.text())).not.toContain(
      'Nome della libreria',
    );
    expect(wrapper.find('.library_name_form').exists()).toBe(false);
  });

  it('shows the library list in the library tab', async () => {
    const wrapper = mount(SettingsView, withPinia());

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.findAll('.settings_section_title').map((titolo) => titolo.text())).toEqual([
      'Import / Export',
      'Librerie',
    ]);
    expect(wrapper.find('.import_export_panel').exists()).toBe(true);
    expect(wrapper.find('.library_list').exists()).toBe(true);
  });

  it('shows name, version, and project link at the bottom', () => {
    const wrapper = mount(SettingsView, withPinia());

    expect(wrapper.get('.settings_footer_name').text()).toBe(APP_NAME);
    expect(wrapper.find('[data-testid="github-link"]').exists()).toBe(true);
  });

  it('translates tabs and sections when the language changes', async () => {
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
      'Default audio player',
    ]);
  });

  it('returns to the library', async () => {
    const options = withPinia();
    const navigation = useNavigationStore();
    navigation.go('settings');
    const wrapper = mount(SettingsView, options);

    await wrapper.get('[data-testid="back-to-library"]').trigger('click');

    expect(navigation.view).toBe('library');
  });
});
