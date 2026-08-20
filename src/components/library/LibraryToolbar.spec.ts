import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTracks } from '../../../tests/support/tracks';
import { useLibraryStore } from '@/stores/library';

import LibraryToolbar from './LibraryToolbar.vue';

beforeEach(() => {
  resetI18n();
});

describe('LibraryToolbar', () => {
  it('counts tracks in the library', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.tracks = makeTracks(3);

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="track-count"]').text()).toBe('3 brani');
  });

  it('uses singular for one track', async () => {
    const options = withPinia();
    useLibraryStore().tracks = makeTracks(1);

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="track-count"]').text()).toBe('1 brano');
  });

  it('reports missing files', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.tracks = [
      ...makeTracks(1),
      ...makeTracks(1).map((track) => ({ ...track, missing: true })),
    ];

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.library_toolbar_missing').text()).toBe('1 file non trovato');
  });

  it('opens the system dialog from the add button', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    const pickAndAdd = vi.spyOn(store, 'pickAndAdd').mockResolvedValue(null);

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.get('button').trigger('click');

    expect(pickAndAdd).toHaveBeenCalledTimes(1);
  });

  it('blocca il pulsante durante l import', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.isImporting = true;

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    expect(wrapper.get('button').text()).toBe('Importazione in corso…');
  });

  it('updates search in the store', async () => {
    const options = withPinia();
    const store = useLibraryStore();

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.get('input').setValue('rock');

    expect(store.query).toBe('rock');
  });

  it('updates the missing information filter', async () => {
    const options = withPinia();
    const store = useLibraryStore();

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.get('select').setValue('artist');

    expect(store.missingInfoFilter).toBe('artist');
  });
});
