import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useLibraryStore } from '@/stores/library';

import LibraryCreateForm from '@/components/settings/LibraryCreateForm.vue';

beforeEach(() => {
  resetI18n();
});

function mountForm() {
  const options = withPinia();
  const library = useLibraryStore();
  vi.spyOn(library, 'loadLibraries').mockResolvedValue();

  return { wrapper: mount(LibraryCreateForm, options), library };
}

describe('LibraryCreateForm', () => {
  it('stops the field before the name gets absurd', () => {
    const wrapper = mount(LibraryCreateForm, withPinia());

    expect(wrapper.get('input').attributes('maxlength')).toBe('120');
  });

  it('creates a library and clears the field', async () => {
    const { wrapper, library } = mountForm();
    const createLibrary = vi.spyOn(library, 'createLibrary').mockResolvedValue(true);

    await wrapper.get('input').setValue('Soundtracks');
    await wrapper.get('form').trigger('submit');

    expect(createLibrary).toHaveBeenCalledWith('Soundtracks');
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
  });

  it('keeps the name when creation fails', async () => {
    const { wrapper, library } = mountForm();
    vi.spyOn(library, 'createLibrary').mockResolvedValue(false);

    await wrapper.get('input').setValue('Soundtracks');
    await wrapper.get('form').trigger('submit');

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Soundtracks');
  });
});
