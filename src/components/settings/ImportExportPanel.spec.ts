import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { useLibraryStore } from '@/stores/library';

import ImportExportPanel from './ImportExportPanel.vue';

beforeEach(() => {
  resetI18n();
});

function mountPanel() {
  const options = withPinia();
  const library = useLibraryStore();
  library.libraries = [{ id: 'lib-1', name: 'Main', trackCount: 0, active: true }];

  return { wrapper: mount(ImportExportPanel, options), library };
}

describe('ImportExportPanel', () => {
  it('imports with the selected strategy', async () => {
    const { wrapper, library } = mountPanel();
    const importLibrary = vi.spyOn(library, 'importLibrary').mockResolvedValue(true);

    await wrapper.get('select').setValue('replace');
    await wrapper.get('[data-testid="import-library-file"]').trigger('click');

    expect(importLibrary).toHaveBeenCalledWith('replace');
  });

  it('exports the active library', async () => {
    const { wrapper, library } = mountPanel();
    const exportLibrary = vi.spyOn(library, 'exportLibrary').mockResolvedValue(true);

    await wrapper.get('[data-testid="export-active-library"]').trigger('click');

    expect(exportLibrary).toHaveBeenCalledWith('lib-1');
  });

  it('shows and closes the import summary', async () => {
    const { wrapper, library } = mountPanel();
    library.lastLibraryImport = {
      added: 2,
      updated: 1,
      skipped: 3,
      missing: ['C:/manca.mp3'],
      total: 6,
    };
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[role="status"]').text()).toContain('6 brani letti');

    await wrapper.get('[role="status"] button').trigger('click');

    expect(library.lastLibraryImport).toBeNull();
  });
});
