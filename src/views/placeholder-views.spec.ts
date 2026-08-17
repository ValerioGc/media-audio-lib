import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n } from '../../tests/support/mount';
import { i18n } from '@/i18n';

import LibraryView from './LibraryView.vue';
import PlayerView from './PlayerView.vue';

beforeEach(() => {
  resetI18n();
});

describe('viste segnaposto', () => {
  it('la libreria annuncia la fase in cui arrivera', () => {
    const wrapper = mount(LibraryView, { global: { plugins: [i18n] } });

    expect(wrapper.get('.app_placeholder_title').text()).toBe('Libreria');
    expect(wrapper.get('.app_placeholder_message').text()).toContain('Fase 4');
  });

  it('il player annuncia la fase in cui arrivera', () => {
    const wrapper = mount(PlayerView, { global: { plugins: [i18n] } });

    expect(wrapper.get('.app_placeholder_title').text()).toBe('Player');
    expect(wrapper.get('.app_placeholder_message').text()).toContain('Fase 8');
  });
});
