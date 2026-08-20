import { mount, type VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useLibraryStore } from '@/stores/library';
import { useSettingsStore } from '@/stores/settings';

import LibraryList from '@/components/settings/LibraryList.vue';

const catalog = [
  { id: 'lib-1', name: 'Main', trackCount: 2, active: true },
  { id: 'lib-2', name: 'Jazz', trackCount: 0, active: false },
];

beforeEach(() => {
  resetI18n();
});

function mountList(libraries = catalog): {
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
  it('lists libraries with the track count', () => {
    const { wrapper } = mountList();
    const items = wrapper.findAll('.library_list_item');

    expect(items).toHaveLength(2);
    expect(items[0]?.get('.library_list_item_name').text()).toBe('Main');
    expect(items[0]?.get('.library_list_item_meta').text()).toContain('2 brani');
    expect(items[0]?.get('.library_list_item_meta').text()).toContain('in uso');
    expect(items[1]?.get('.library_list_item_meta').text()).toContain('nessun brano');
  });

  it('does not offer opening the library already in use', () => {
    const { wrapper } = mountList();

    expect(wrapper.findAll('[data-testid="open-library"]')).toHaveLength(1);
  });

  it('opens another library', async () => {
    const { wrapper, library } = mountList();
    const switchLibrary = vi.spyOn(library, 'switchLibrary').mockResolvedValue(true);

    await wrapper.get('[data-testid="open-library"]').trigger('click');

    expect(switchLibrary).toHaveBeenCalledWith('lib-2');
  });

  it('marks a library as primary and opens it for the home', async () => {
    const { wrapper, library } = mountList();
    const settings = useSettingsStore();
    const switchLibrary = vi.spyOn(library, 'switchLibrary').mockResolvedValue(true);
    const setMainLibraryId = vi.spyOn(settings, 'setMainLibraryId').mockResolvedValue();

    await wrapper.findAll('[data-testid="set-main-library"]')[1]?.trigger('click');

    expect(switchLibrary).toHaveBeenCalledWith('lib-2');
    expect(setMainLibraryId).toHaveBeenCalledWith('lib-2');
  });

  it('shows the primary library marker', async () => {
    const { wrapper } = mountList();
    useSettingsStore().mainLibraryId = 'lib-2';
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.library_list_item_meta')[1]?.text()).toContain('principale');
  });

  it('exports the chosen library', async () => {
    const { wrapper, library } = mountList();
    const exportLibrary = vi.spyOn(library, 'exportLibrary').mockResolvedValue(true);

    await wrapper.findAll('[data-testid="export-library"]')[1]?.trigger('click');

    expect(exportLibrary).toHaveBeenCalledWith('lib-2');
  });

  it('shows where export ended up and closes it', async () => {
    const { wrapper, library } = mountList();
    library.lastExport = 'C:/backup/jazz.json';
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[role="status"]').text()).toContain('C:/backup/jazz.json');

    await wrapper.get('[role="status"] button').trigger('click');

    expect(library.lastExport).toBeNull();
  });

  it('deletes only after confirmation', async () => {
    const { wrapper, library } = mountList();
    const deleteLibrary = vi.spyOn(library, 'deleteLibrary').mockResolvedValue(true);

    await wrapper.findAll('[data-testid="delete-library"]')[1]?.trigger('click');
    expect(deleteLibrary).not.toHaveBeenCalled();

    await wrapper.get('[data-testid="confirm-library-delete"]').trigger('click');

    expect(deleteLibrary).toHaveBeenCalledWith('lib-2');
  });

  it('clears the primary library when it is deleted', async () => {
    const { wrapper, library } = mountList();
    const settings = useSettingsStore();
    settings.mainLibraryId = 'lib-2';
    vi.spyOn(library, 'deleteLibrary').mockResolvedValue(true);
    const setMainLibraryId = vi.spyOn(settings, 'setMainLibraryId').mockResolvedValue();

    await wrapper.findAll('[data-testid="delete-library"]')[1]?.trigger('click');
    await wrapper.get('[data-testid="confirm-library-delete"]').trigger('click');

    expect(setMainLibraryId).toHaveBeenCalledWith(library.activeLibraryId);
  });

  it('keeps deletion disabled with a single library', () => {
    const { wrapper } = mountList([catalog[0]!]);

    expect(wrapper.get('[data-testid="delete-library"]').attributes('disabled')).toBeDefined();
  });

  it('creates a library and clears the field', async () => {
    const { wrapper, library } = mountList();
    const createLibrary = vi.spyOn(library, 'createLibrary').mockResolvedValue(true);

    await wrapper.get('input').setValue('Soundtracks');
    await wrapper.get('.library_list_create').trigger('submit');

    expect(createLibrary).toHaveBeenCalledWith('Soundtracks');
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
  });

  it('keeps the name when creation fails', async () => {
    const { wrapper, library } = mountList();
    vi.spyOn(library, 'createLibrary').mockResolvedValue(false);

    await wrapper.get('input').setValue('Soundtracks');
    await wrapper.get('.library_list_create').trigger('submit');

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Soundtracks');
  });
});
