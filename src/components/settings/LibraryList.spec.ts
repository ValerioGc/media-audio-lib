import { mount, type VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { useLibraryStore } from '@/stores/library';

import LibraryList from './LibraryList.vue';

const catalogo = [
  { id: 'lib-1', name: 'Principale', trackCount: 2, active: true },
  { id: 'lib-2', name: 'Jazz', trackCount: 0, active: false },
];

beforeEach(() => {
  resetI18n();
});

function mountList(libraries = catalogo): {
  wrapper: VueWrapper;
  library: ReturnType<typeof useLibraryStore>;
} {
  const options = withPinia();
  const library = useLibraryStore();
  vi.spyOn(library, 'loadLibraries').mockResolvedValue();
  library.libraries = libraries;

  return { wrapper: mount(LibraryList, options), library };
}

describe('LibraryList', () => {
  it('elenca le librerie con il numero di brani', () => {
    const { wrapper } = mountList();
    const voci = wrapper.findAll('.library_list_item');

    expect(voci).toHaveLength(2);
    expect(voci[0]?.get('.library_list_item_name').text()).toBe('Principale');
    expect(voci[0]?.get('.library_list_item_meta').text()).toContain('2 brani');
    expect(voci[0]?.get('.library_list_item_meta').text()).toContain('in uso');
    expect(voci[1]?.get('.library_list_item_meta').text()).toContain('nessun brano');
  });

  it('non offre di aprire la libreria gia in uso', () => {
    const { wrapper } = mountList();

    expect(wrapper.findAll('[data-testid="open-library"]')).toHaveLength(1);
  });

  it('apre un altra libreria', async () => {
    const { wrapper, library } = mountList();
    const switchLibrary = vi.spyOn(library, 'switchLibrary').mockResolvedValue(true);

    await wrapper.get('[data-testid="open-library"]').trigger('click');

    expect(switchLibrary).toHaveBeenCalledWith('lib-2');
  });

  it('esporta la libreria scelta', async () => {
    const { wrapper, library } = mountList();
    const exportLibrary = vi.spyOn(library, 'exportLibrary').mockResolvedValue(true);

    await wrapper.findAll('[data-testid="export-library"]')[1]?.trigger('click');

    expect(exportLibrary).toHaveBeenCalledWith('lib-2');
  });

  it('mostra dove e finito l export e lo chiude', async () => {
    const { wrapper, library } = mountList();
    library.lastExport = 'C:/backup/jazz.json';
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[role="status"]').text()).toContain('C:/backup/jazz.json');

    await wrapper.get('[role="status"] button').trigger('click');

    expect(library.lastExport).toBeNull();
  });

  it('elimina solo dopo conferma', async () => {
    const { wrapper, library } = mountList();
    const deleteLibrary = vi.spyOn(library, 'deleteLibrary').mockResolvedValue(true);

    await wrapper.findAll('[data-testid="delete-library"]')[1]?.trigger('click');
    expect(deleteLibrary).not.toHaveBeenCalled();

    await wrapper.get('[data-testid="confirm-library-delete"]').trigger('click');

    expect(deleteLibrary).toHaveBeenCalledWith('lib-2');
  });

  it('con una sola libreria l eliminazione e spenta', () => {
    const { wrapper } = mountList([catalogo[0]!]);

    expect(wrapper.get('[data-testid="delete-library"]').attributes('disabled')).toBeDefined();
  });

  it('crea una libreria e ripulisce il campo', async () => {
    const { wrapper, library } = mountList();
    const createLibrary = vi.spyOn(library, 'createLibrary').mockResolvedValue(true);

    await wrapper.get('input').setValue('Colonne sonore');
    await wrapper.get('.library_list_create').trigger('submit');

    expect(createLibrary).toHaveBeenCalledWith('Colonne sonore');
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
  });

  it('tiene il nome quando la creazione non riesce', async () => {
    const { wrapper, library } = mountList();
    vi.spyOn(library, 'createLibrary').mockResolvedValue(false);

    await wrapper.get('input').setValue('Colonne sonore');
    await wrapper.get('.library_list_create').trigger('submit');

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Colonne sonore');
  });
});
