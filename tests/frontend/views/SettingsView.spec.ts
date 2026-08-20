import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { APP_NAME } from '@/config/app-config';
import { useNavigationStore } from '@/stores/navigation';
import { useSettingsStore } from '@/stores/settings';

import SettingsView from '@/views/SettingsView.vue';

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
      'Aspetto',
      'Libreria',
    ]);
  });

  it('groups general application settings under the first tab', () => {
    const wrapper = mount(SettingsView, withPinia());

    const titles = wrapper.findAll('.settings_section_title').map((title) => title.text());

    expect(titles).toEqual(['Lingua', 'Player audio predefinito']);
  });

  it('groups appearance settings with application and audio player dividers', async () => {
    const wrapper = mount(SettingsView, withPinia());

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.findAll('.settings_view_divider').map((divider) => divider.text())).toEqual([
      'Applicazione',
      'Player audio',
    ]);
    expect(wrapper.findAll('.settings_section_title').map((title) => title.text())).toEqual([
      'Dimensione testo',
      'Tema',
      'Colore accent',
      'Sfondo da copertina',
    ]);
  });

  it('does not show rename in the library tab', async () => {
    const wrapper = mount(SettingsView, withPinia());

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');

    expect(wrapper.findAll('.settings_section_title').map((title) => title.text())).not.toContain(
      'Nome della libreria',
    );
    expect(wrapper.find('.library_name_form').exists()).toBe(false);
  });

  it('shows the library list in the library tab', async () => {
    const wrapper = mount(SettingsView, withPinia());

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');

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
      'Appearance',
      'Library',
    ]);
    expect(wrapper.findAll('.settings_section_title').map((title) => title.text())).toEqual([
      'Language',
      'Default audio player',
    ]);

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.findAll('.settings_section_title').map((title) => title.text())).toEqual([
      'Text size',
      'Theme',
      'Accent colour',
      'Cover background',
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
