import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import type { LibraryContentTab } from '@/types/library';

import LibraryContentTabs from '@/components/library/LibraryContentTabs.vue';

beforeEach(() => {
  resetI18n();
});

function mountTabs(modelValue: LibraryContentTab = 'tracks') {
  return mount(LibraryContentTabs, { ...withPinia(), props: { modelValue } });
}

describe('LibraryContentTabs', () => {
  it('renders library sections', () => {
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

  it('emits section changes', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['artists']]);
  });

  it('moves between sections with the arrow keys', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[0]?.trigger('keydown', { key: 'ArrowRight' });

    expect(wrapper.emitted('update:modelValue')).toEqual([['artists']]);
  });

  it('wraps around at the ends', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[0]?.trigger('keydown', { key: 'ArrowLeft' });

    expect(wrapper.emitted('update:modelValue')).toEqual([['genres']]);
  });

  it('jumps to the first and the last section', async () => {
    const wrapper = mountTabs('albums');

    await wrapper.findAll('[role="tab"]')[2]?.trigger('keydown', { key: 'End' });
    await wrapper.findAll('[role="tab"]')[2]?.trigger('keydown', { key: 'Home' });

    expect(wrapper.emitted('update:modelValue')).toEqual([['genres'], ['tracks']]);
  });

  it('leaves the other keys alone', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[0]?.trigger('keydown', { key: 'a' });

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('hides the indicator until the tabs can be measured', () => {
    const wrapper = mountTabs();

    // jsdom has no layout: with every width at zero the bar has nowhere to go.
    expect(wrapper.get('.library_content_tabs_indicator').isVisible()).toBe(false);
  });
});
