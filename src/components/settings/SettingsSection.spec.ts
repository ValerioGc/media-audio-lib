import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import SettingsSection from './SettingsSection.vue';

describe('SettingsSection', () => {
  it('mostra titolo e descrizione', () => {
    const wrapper = mount(SettingsSection, {
      props: { title: 'Tema', description: 'Chiaro o scuro' },
    });

    expect(wrapper.get('.settings_section_title').text()).toBe('Tema');
    expect(wrapper.get('.settings_section_description').text()).toBe('Chiaro o scuro');
  });

  it('rende il contenuto dello slot', () => {
    const wrapper = mount(SettingsSection, {
      props: { title: 'Tema', description: 'Chiaro o scuro' },
      slots: { default: '<p class="controllo">contenuto</p>' },
    });

    expect(wrapper.get('.settings_section_body .controllo').text()).toBe('contenuto');
  });
});
