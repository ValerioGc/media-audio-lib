import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import * as api from '@/services/library-api';

import LibraryNameForm from './LibraryNameForm.vue';

vi.mock('@/services/library-api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>();

  return {
    ...actual,
    libraryInfo: vi.fn(),
    renameLibrary: vi.fn(),
  };
});

const libraryInfo = vi.mocked(api.libraryInfo);
const renameLibrary = vi.mocked(api.renameLibrary);

beforeEach(() => {
  resetI18n();
  libraryInfo.mockResolvedValue({ name: 'Media Audio Lib' });
  renameLibrary.mockResolvedValue({ name: 'Archivio' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LibraryNameForm', () => {
  it('carica il nome quando non e ancora nello store', async () => {
    const wrapper = mount(LibraryNameForm, withPinia());
    await flushPromises();

    expect(libraryInfo).toHaveBeenCalled();
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Media Audio Lib');
  });

  it('salva il nome ripulito dagli spazi', async () => {
    const wrapper = mount(LibraryNameForm, withPinia());
    await flushPromises();

    await wrapper.get('input').setValue('  Archivio  ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(renameLibrary).toHaveBeenCalledWith('Archivio');
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Archivio');
  });

  it('mostra la validazione per un nome vuoto', async () => {
    const wrapper = mount(LibraryNameForm, withPinia());
    await flushPromises();

    await wrapper.get('input').setValue('   ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(renameLibrary).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Il nome della libreria non può essere vuoto.',
    );
  });
});
