import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import type { LibraryContentTab } from '@/types/library';

import LibraryContentTabs from './LibraryContentTabs.vue';

beforeEach(() => {
  resetI18n();
});

function mountTabs(modelValue: LibraryContentTab = 'tracks') {
  return mount(LibraryContentTabs, { ...withPinia(), props: { modelValue } });
}

describe('LibraryContentTabs', () => {
  it('rende le sezioni della libreria', () => {
    const wrapper = mountTabs();

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Brani',
      'Autori',
      'Album',
      'Generi',
    ]);
  });

  it('marca la tab attiva', () => {
    const wrapper = mountTabs('albums');

    expect(wrapper.findAll('[role="tab"]')[2]?.attributes('aria-selected')).toBe('true');
    expect(wrapper.findAll('[role="tab"]')[2]?.classes()).toContain(
      'library_content_tabs_tab_active',
    );
  });

  it('emette il cambio di sezione', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['artists']]);
  });
});
