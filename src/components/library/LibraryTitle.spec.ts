import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { useLibraryStore } from '@/stores/library';

import LibraryTitle from './LibraryTitle.vue';

const wrappers: VueWrapper[] = [];

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});

function mountTitle() {
  const options = withPinia();
  const library = useLibraryStore();
  const wrapper = mount(LibraryTitle, { ...options, attachTo: document.body });
  wrappers.push(wrapper);

  return { wrapper, library };
}

describe('LibraryTitle', () => {
  it('usa il nome della libreria e ripiega sul titolo generico', async () => {
    const { wrapper, library } = mountTitle();

    expect(wrapper.get('.library_title_name').text()).toBe('Libreria');

    library.libraryName = 'Archivio jazz';
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.library_title_name').text()).toBe('Archivio jazz');
  });

  it('apre il campo di modifica dall icona della penna', async () => {
    const { wrapper, library } = mountTitle();
    library.libraryName = 'Archivio jazz';
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-testid="library-name-edit"]').trigger('click');

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

    await wrapper.get('[data-testid="library-name-edit"]').trigger('click');
    await wrapper.get('[data-testid="library-name-field"]').setValue('Colonne sonore');
    await wrapper.get('.library_title_form').trigger('submit');

    expect(rename).toHaveBeenCalledWith('Colonne sonore');
    expect(wrapper.get('.library_title_name').text()).toBe('Colonne sonore');
  });

  it('tiene aperto il campo quando il nome viene rifiutato', async () => {
    const { wrapper, library } = mountTitle();
    vi.spyOn(library, 'renameLibrary').mockResolvedValue(false);

    await wrapper.get('[data-testid="library-name-edit"]').trigger('click');
    await wrapper.get('[data-testid="library-name-field"]').setValue('   ');
    await wrapper.get('.library_title_form').trigger('submit');

    expect(wrapper.find('[data-testid="library-name-field"]').exists()).toBe(true);
  });

  it('annulla la modifica con il pulsante e con Escape', async () => {
    const { wrapper, library } = mountTitle();
    library.libraryName = 'Archivio jazz';
    const rename = vi.spyOn(library, 'renameLibrary');
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-testid="library-name-edit"]').trigger('click');
    await wrapper.get('[data-testid="library-name-field"]').setValue('Altro');
    await wrapper.get('[data-testid="library-name-cancel"]').trigger('click');

    expect(wrapper.get('.library_title_name').text()).toBe('Archivio jazz');

    await wrapper.get('[data-testid="library-name-edit"]').trigger('click');
    await wrapper.get('[data-testid="library-name-field"]').trigger('keydown.esc');

    expect(wrapper.get('.library_title_name').text()).toBe('Archivio jazz');
    expect(rename).not.toHaveBeenCalled();
  });

  it('elenca le opzioni della libreria ancora non disponibili', async () => {
    const { wrapper } = mountTitle();

    await wrapper.get('.app_menu_trigger').trigger('click');
    const voci = wrapper.findAll('.app_menu_item');

    expect(voci.map((voce) => voce.get('.app_menu_item_label').text())).toEqual([
      'Rinomina',
      'Esporta',
      'Elimina libreria',
    ]);
    voci.forEach((voce) => {
      expect(voce.attributes('disabled')).toBeDefined();
    });
  });
});
