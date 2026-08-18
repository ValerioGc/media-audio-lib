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
  it('conta i brani in libreria', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.tracks = makeTracks(3);

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="track-count"]').text()).toBe('3 brani');
  });

  it('usa il singolare per un solo brano', async () => {
    const options = withPinia();
    useLibraryStore().tracks = makeTracks(1);

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="track-count"]').text()).toBe('1 brano');
  });

  it('segnala i file non trovati', async () => {
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

  it('apre il dialog di sistema dal pulsante di aggiunta', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    const pickAndAdd = vi.spyOn(store, 'pickAndAdd').mockResolvedValue(null);

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.get('button').trigger('click');

    expect(pickAndAdd).toHaveBeenCalledTimes(1);
  });

  it('blocca il pulsante durante l importazione', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.isImporting = true;

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    expect(wrapper.get('button').text()).toBe('Importazione in corso…');
  });

  it('aggiorna la ricerca nello store', async () => {
    const options = withPinia();
    const store = useLibraryStore();

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.get('input').setValue('rock');

    expect(store.query).toBe('rock');
  });
});
