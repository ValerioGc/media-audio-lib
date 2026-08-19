import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { useSettingsStore } from '@/stores/settings';
import { VIEW_MODES } from '@/types/settings';

import LibraryToolbar from './LibraryToolbar.vue';

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  localStorage.clear();
});

/** The view toggle lives in the toolbar, next to search and counters. */
describe('toggle della vista', () => {
  it('offre elenco e anteprime', () => {
    const wrapper = mount(LibraryToolbar, withPinia());
    const labels = wrapper
      .findAll('.library_toolbar_view .app_option_group_item')
      .map((item) => item.text());

    expect(labels).toEqual(['Elenco', 'Anteprime']);
    expect(labels).toHaveLength(VIEW_MODES.length);
  });

  it('parte dalla vista a elenco', () => {
    const wrapper = mount(LibraryToolbar, withPinia());

    const selected = wrapper.findAll('.library_toolbar_view .app_option_group_item_selected');

    expect(selected).toHaveLength(1);
    expect(selected[0]?.text()).toBe('Elenco');
  });

  it('scrive la scelta nelle impostazioni', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const setViewMode = vi.spyOn(settings, 'setViewMode');

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.findAll('.library_toolbar_view input')[1]?.trigger('change');

    expect(setViewMode).toHaveBeenCalledWith('preview');
    expect(settings.viewMode).toBe('preview');
  });

  it('riflette la vista gia salvata nelle preferenze', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    await settings.setViewMode('preview');

    const wrapper = mount(LibraryToolbar, options);

    expect(wrapper.get('.library_toolbar_view .app_option_group_item_selected').text()).toBe(
      'Anteprime',
    );
  });
});
