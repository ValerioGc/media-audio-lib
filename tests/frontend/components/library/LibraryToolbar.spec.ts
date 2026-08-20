import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTracks } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';

import LibraryToolbar from '@/components/library/LibraryToolbar.vue';

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

  it('opens the system dialog from the unified add menu', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    const pickAndAdd = vi.spyOn(store, 'pickAndAdd').mockResolvedValue(null);

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.get('[data-testid="library-import-open"]').trigger('click');
    await wrapper.findAll('.library_import_button_item')[0]?.trigger('click');

    expect(pickAndAdd).toHaveBeenCalledTimes(1);
  });

  it('opens the folder dialog from the unified add menu', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    const pickFoldersAndAdd = vi.spyOn(store, 'pickFoldersAndAdd').mockResolvedValue(null);

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.get('[data-testid="library-import-open"]').trigger('click');
    await wrapper.findAll('.library_import_button_item')[1]?.trigger('click');

    expect(pickFoldersAndAdd).toHaveBeenCalledTimes(1);
  });

  it('blocca il pulsante durante l import', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.isImporting = true;

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="library-import-open"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="library-import-open"]').text()).toContain(
      'Importazione in corso…',
    );
  });

  it('updates search in the store', async () => {
    const options = withPinia();
    const store = useLibraryStore();

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.get('input').setValue('rock');

    expect(store.query).toBe('rock');
  });

  it('keeps the missing information filter out of the toolbar', () => {
    const wrapper = mount(LibraryToolbar, withPinia());

    expect(wrapper.find('select').exists()).toBe(false);
  });

  it('shows the active missing information filter without adding another control', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.setMissingInfoFilter('artist');

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="missing-info-active"]').text()).toBe('Mancanti: Autore');
  });

  it('offers batch editing only for multiple selected tracks', async () => {
    const wrapper = mount(LibraryToolbar, { ...withPinia(), props: { selectedCount: 2 } });

    await wrapper.get('[data-testid="bulk-edit-open"]').trigger('click');

    expect(wrapper.emitted('editSelected')).toHaveLength(1);
  });
});
