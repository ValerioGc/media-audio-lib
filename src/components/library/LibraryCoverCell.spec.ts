import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';
import { useLibraryStore } from '@/stores/library';

import LibraryCoverCell from './LibraryCoverCell.vue';

beforeEach(() => {
  resetI18n();
});

describe('LibraryCoverCell', () => {
  it('mostra un segnaposto quando non c e copertina', async () => {
    const wrapper = mount(LibraryCoverCell, {
      ...withPinia(),
      props: { track: makeTrack({ hasCover: false }) },
    });
    await flushPromises();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('.library_cover_fallback').attributes('aria-label')).toBe(
      'Nessuna copertina',
    );
  });

  it('mostra la copertina caricata dallo store', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    vi.spyOn(store, 'loadCover').mockResolvedValue('data:image/png;base64,AAA');

    const wrapper = mount(LibraryCoverCell, {
      ...options,
      props: { track: makeTrack({ hasCover: true }) },
    });
    await flushPromises();

    expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,AAA');
  });

  it('ricarica la copertina quando cambia il brano', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    const loadCover = vi.spyOn(store, 'loadCover').mockResolvedValue(null);

    const wrapper = mount(LibraryCoverCell, {
      ...options,
      props: { track: makeTrack() },
    });
    await flushPromises();
    await wrapper.setProps({ track: makeTrack() });
    await flushPromises();

    expect(loadCover).toHaveBeenCalledTimes(2);
  });
});
