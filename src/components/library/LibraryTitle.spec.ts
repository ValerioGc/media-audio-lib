import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';
import { useLibraryStore } from '@/stores/library';
import { useSettingsStore } from '@/stores/settings';

import LibraryTitle from './LibraryTitle.vue';

const wrappers: VueWrapper[] = [];

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});

const catalog = [
  { id: 'lib-1', name: 'Main', trackCount: 2, active: true },
  { id: 'lib-2', name: 'Jazz', trackCount: 5, active: false },
];

function mountTitle(libraries = catalog) {
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
  const item = wrapper
    .findAll('.app_menu_item')
    .find((item) => item.get('.app_menu_item_label').text() === 'Rinomina');

  await item?.trigger('click');
}

describe('LibraryTitle', () => {
  it('uses the library name and falls back to the generic title', async () => {
    const { wrapper, library } = mountTitle();

    expect(wrapper.get('.library_title_name').text()).toBe('Libreria');

    library.libraryName = 'Jazz Archive';
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.library_title_name').text()).toBe('Jazz Archive');
  });

  it('opens the edit field from the menu', async () => {
    const { wrapper, library } = mountTitle();
    library.libraryName = 'Jazz Archive';
    await wrapper.vm.$nextTick();

    await openRename(wrapper);

    const field = wrapper.get('[data-testid="library-name-field"]');
    expect((field.element as HTMLInputElement).value).toBe('Jazz Archive');
    expect(wrapper.find('.library_title_name').exists()).toBe(false);
  });

  it('saves the new name and returns to the title', async () => {
    const { wrapper, library } = mountTitle();
    const rename = vi.spyOn(library, 'renameLibrary').mockImplementation(async (name) => {
      library.libraryName = name;
      return true;
    });

    await openRename(wrapper);
    await wrapper.get('[data-testid="library-name-field"]').setValue('Soundtracks');
    await wrapper.get('.library_title_form').trigger('submit');

    expect(rename).toHaveBeenCalledWith('Soundtracks');
    expect(wrapper.get('.library_title_name').text()).toBe('Soundtracks');
  });

  it('keeps the field open when the name is rejected', async () => {
    const { wrapper, library } = mountTitle();
    vi.spyOn(library, 'renameLibrary').mockResolvedValue(false);

    await openRename(wrapper);
    await wrapper.get('[data-testid="library-name-field"]').setValue('   ');
    await wrapper.get('.library_title_form').trigger('submit');

    expect(wrapper.find('[data-testid="library-name-field"]').exists()).toBe(true);
  });

  it('cancels editing with the button and Escape', async () => {
    const { wrapper, library } = mountTitle();
    library.libraryName = 'Jazz Archive';
    const rename = vi.spyOn(library, 'renameLibrary');
    await wrapper.vm.$nextTick();

    await openRename(wrapper);
    await wrapper.get('[data-testid="library-name-field"]').setValue('Other');
    await wrapper.get('[data-testid="library-name-cancel"]').trigger('click');

    expect(wrapper.get('.library_title_name').text()).toBe('Jazz Archive');

    await openRename(wrapper);
    await wrapper.get('[data-testid="library-name-field"]').trigger('keydown.esc');

    expect(wrapper.get('.library_title_name').text()).toBe('Jazz Archive');
    expect(rename).not.toHaveBeenCalled();
  });

  it('lists only actions in the library options menu', async () => {
    const { wrapper } = mountTitle();

    await wrapper.get('.app_menu_trigger').trigger('click');
    const items = wrapper.findAll('.app_menu_item');

    expect(items.map((item) => item.get('.app_menu_item_label').text())).toEqual([
      'Rinomina',
      'Verifica file',
      'Esporta elenco',
      'Esporta libreria',
      'Elimina libreria',
    ]);
  });

  it('opens the library switcher from the title', async () => {
    const { wrapper, library } = mountTitle();
    const switchLibrary = vi.spyOn(library, 'switchLibrary').mockResolvedValue(true);

    await wrapper.get('[data-testid="library-switcher-open"]').trigger('click');
    await wrapper.findAll('[data-testid="switch-library"]')[1]?.trigger('click');

    expect(switchLibrary).toHaveBeenCalledWith('lib-2');
  });

  it('there is no longer a pencil next to the name: use the menu', () => {
    const { wrapper } = mountTitle();

    expect(wrapper.find('[data-testid="library-name-edit"]').exists()).toBe(false);
    expect(wrapper.findAll('.library_title_action')).toHaveLength(0);
  });

  it('exports the open library', async () => {
    const { wrapper, library } = mountTitle();
    const exportLibrary = vi.spyOn(library, 'exportLibrary').mockResolvedValue(true);

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[3]?.trigger('click');

    expect(exportLibrary).toHaveBeenCalledWith('lib-1');
  });

  it('verifies all files from the library menu', async () => {
    const { wrapper, library } = mountTitle();
    library.tracks = [{ ...makeTrack(), missing: false }];
    const verifyAllTracks = vi.spyOn(library, 'verifyAllTracks').mockResolvedValue({
      total: 1,
      missing: 0,
    });
    await wrapper.vm.$nextTick();

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[1]?.trigger('click');

    expect(verifyAllTracks).toHaveBeenCalledTimes(1);
  });

  it('opens the dialog to export the track list', async () => {
    const { wrapper, library } = mountTitle();
    library.tracks = [{ ...makeTrack(), missing: false }];
    await wrapper.vm.$nextTick();

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[2]?.trigger('click');

    expect(document.body.textContent).toContain('Esporta elenco brani');
  });

  it('asks for confirmation before deleting the library', async () => {
    const { wrapper, library } = mountTitle();
    const deleteLibrary = vi.spyOn(library, 'deleteLibrary').mockResolvedValue(true);

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[4]?.trigger('click');

    expect(wrapper.get('[role="dialog"]').text()).toContain('Main');
    expect(deleteLibrary).not.toHaveBeenCalled();

    await wrapper.get('[data-testid="confirm-library-delete"]').trigger('click');

    expect(deleteLibrary).toHaveBeenCalledWith('lib-1');
  });

  it('updates the primary library after deleting it from the title menu', async () => {
    const { wrapper, library } = mountTitle();
    const settings = useSettingsStore();
    settings.mainLibraryId = 'lib-1';
    vi.spyOn(library, 'deleteLibrary').mockImplementation(async () => {
      library.libraries = [{ ...catalog[1]!, active: true }];
      return true;
    });
    const setMainLibraryId = vi.spyOn(settings, 'setMainLibraryId').mockResolvedValue();

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[4]?.trigger('click');
    await wrapper.get('[data-testid="confirm-library-delete"]').trigger('click');

    expect(setMainLibraryId).toHaveBeenCalledWith('lib-2');
  });

  it('keeps deletion disabled with a single library', async () => {
    const { wrapper } = mountTitle([catalog[0]!]);

    await wrapper.get('.app_menu_trigger').trigger('click');
    const items = wrapper.findAll('.app_menu_item');

    expect(items.at(-1)?.attributes('disabled')).toBeDefined();
  });
});
