import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';
import { useLibraryStore } from '@/stores/library';

import LibraryTitle from './LibraryTitle.vue';

const wrappers: VueWrapper[] = [];

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});

const catalogo = [
  { id: 'lib-1', name: 'Principale', trackCount: 2, active: true },
  { id: 'lib-2', name: 'Jazz', trackCount: 5, active: false },
];

function mountTitle(libraries = catalogo) {
  const options = withPinia();
  const library = useLibraryStore();
  // The list normally arrives from the backend on mount.
  vi.spyOn(library, 'loadLibraries').mockResolvedValue();
  library.libraries = libraries;

  const wrapper = mount(LibraryTitle, { ...options, attachTo: document.body });
  wrappers.push(wrapper);

  return { wrapper, library };
}

/** Renaming has one entry point: the menu next to the name. */
async function openRename(wrapper: VueWrapper) {
  await wrapper.get('.app_menu_trigger').trigger('click');
  const voce = wrapper
    .findAll('.app_menu_item')
    .find((item) => item.get('.app_menu_item_label').text() === 'Rinomina');

  await voce?.trigger('click');
}

describe('LibraryTitle', () => {
  it('usa il nome della libreria e ripiega sul titolo generico', async () => {
    const { wrapper, library } = mountTitle();

    expect(wrapper.get('.library_title_name').text()).toBe('Libreria');

    library.libraryName = 'Archivio jazz';
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.library_title_name').text()).toBe('Archivio jazz');
  });

  it('apre il campo di modifica dal menu', async () => {
    const { wrapper, library } = mountTitle();
    library.libraryName = 'Archivio jazz';
    await wrapper.vm.$nextTick();

    await openRename(wrapper);

    const campo = wrapper.get('[data-testid="library-name-field"]');
    expect((campo.element as HTMLInputElement).value).toBe('Archivio jazz');
    expect(wrapper.find('.library_title_name').exists()).toBe(false);
  });

  it('salva il nuovo nome e torna al titolo', async () => {
    const { wrapper, library } = mountTitle();
    const rename = vi.spyOn(library, 'renameLibrary').mockImplementation(async (name) => {
      library.libraryName = name;
      return true;
    });

    await openRename(wrapper);
    await wrapper.get('[data-testid="library-name-field"]').setValue('Colonne sonore');
    await wrapper.get('.library_title_form').trigger('submit');

    expect(rename).toHaveBeenCalledWith('Colonne sonore');
    expect(wrapper.get('.library_title_name').text()).toBe('Colonne sonore');
  });

  it('tiene aperto il campo quando il nome viene rifiutato', async () => {
    const { wrapper, library } = mountTitle();
    vi.spyOn(library, 'renameLibrary').mockResolvedValue(false);

    await openRename(wrapper);
    await wrapper.get('[data-testid="library-name-field"]').setValue('   ');
    await wrapper.get('.library_title_form').trigger('submit');

    expect(wrapper.find('[data-testid="library-name-field"]').exists()).toBe(true);
  });

  it('annulla la modifica con il pulsante e con Escape', async () => {
    const { wrapper, library } = mountTitle();
    library.libraryName = 'Archivio jazz';
    const rename = vi.spyOn(library, 'renameLibrary');
    await wrapper.vm.$nextTick();

    await openRename(wrapper);
    await wrapper.get('[data-testid="library-name-field"]').setValue('Altro');
    await wrapper.get('[data-testid="library-name-cancel"]').trigger('click');

    expect(wrapper.get('.library_title_name').text()).toBe('Archivio jazz');

    await openRename(wrapper);
    await wrapper.get('[data-testid="library-name-field"]').trigger('keydown.esc');

    expect(wrapper.get('.library_title_name').text()).toBe('Archivio jazz');
    expect(rename).not.toHaveBeenCalled();
  });

  it('elenca le librerie e poi le azioni sulla libreria aperta', async () => {
    const { wrapper } = mountTitle();

    await wrapper.get('.app_menu_trigger').trigger('click');
    const voci = wrapper.findAll('.app_menu_item');

    expect(voci.map((voce) => voce.get('.app_menu_item_label').text())).toEqual([
      'Principale',
      'Jazz',
      'Rinomina',
      'Verifica file',
      'Esporta elenco',
      'Importa',
      'Esporta libreria',
      'Elimina libreria',
    ]);
    expect(voci[0]?.attributes('aria-checked')).toBe('true');
    expect(voci[1]?.attributes('aria-checked')).toBe('false');
  });

  it('apre la libreria scelta dal menu', async () => {
    const { wrapper, library } = mountTitle();
    const switchLibrary = vi.spyOn(library, 'switchLibrary').mockResolvedValue(true);

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[1]?.trigger('click');

    expect(switchLibrary).toHaveBeenCalledWith('lib-2');
  });

  it('accanto al nome non c e piu una penna: si passa dal menu', () => {
    const { wrapper } = mountTitle();

    expect(wrapper.find('[data-testid="library-name-edit"]').exists()).toBe(false);
    expect(wrapper.findAll('.library_title_action')).toHaveLength(0);
  });

  it('esporta la libreria aperta', async () => {
    const { wrapper, library } = mountTitle();
    const exportLibrary = vi.spyOn(library, 'exportLibrary').mockResolvedValue(true);

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[6]?.trigger('click');

    expect(exportLibrary).toHaveBeenCalledWith('lib-1');
  });

  it('importa nella libreria aperta dal menu', async () => {
    const { wrapper, library } = mountTitle();
    const importLibrary = vi.spyOn(library, 'importLibrary').mockResolvedValue(true);

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[5]?.trigger('click');

    expect(importLibrary).toHaveBeenCalledWith('mergeSkipDuplicates');
  });

  it('verifica tutti i file dal menu della libreria', async () => {
    const { wrapper, library } = mountTitle();
    library.tracks = [{ ...makeTrack(), missing: false }];
    const verifyAllTracks = vi.spyOn(library, 'verifyAllTracks').mockResolvedValue({
      total: 1,
      missing: 0,
    });
    await wrapper.vm.$nextTick();

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[3]?.trigger('click');

    expect(verifyAllTracks).toHaveBeenCalledTimes(1);
  });

  it('apre il dialog per esportare l elenco brani', async () => {
    const { wrapper, library } = mountTitle();
    library.tracks = [{ ...makeTrack(), missing: false }];
    await wrapper.vm.$nextTick();

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[4]?.trigger('click');

    expect(document.body.textContent).toContain('Esporta elenco brani');
  });

  it('chiede conferma prima di eliminare la libreria', async () => {
    const { wrapper, library } = mountTitle();
    const deleteLibrary = vi.spyOn(library, 'deleteLibrary').mockResolvedValue(true);

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[7]?.trigger('click');

    expect(wrapper.get('[role="dialog"]').text()).toContain('Principale');
    expect(deleteLibrary).not.toHaveBeenCalled();

    await wrapper.get('[data-testid="confirm-library-delete"]').trigger('click');

    expect(deleteLibrary).toHaveBeenCalledWith('lib-1');
  });

  it('con una sola libreria l eliminazione resta spenta', async () => {
    const { wrapper } = mountTitle([catalogo[0]!]);

    await wrapper.get('.app_menu_trigger').trigger('click');
    const voci = wrapper.findAll('.app_menu_item');

    expect(voci.at(-1)?.attributes('disabled')).toBeDefined();
  });
});
