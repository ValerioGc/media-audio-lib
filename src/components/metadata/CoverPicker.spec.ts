import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n } from '../../../tests/support/mount';
import { i18n } from '@/i18n';
import { MAX_COVER_BYTES } from '@/services/metadata-validation';

import CoverPicker from './CoverPicker.vue';

beforeEach(() => {
  resetI18n();
});

function mountPicker(current: string | null = null) {
  return mount(CoverPicker, { global: { plugins: [i18n] }, props: { current } });
}

/** Drives the hidden file input the way the browser would after a pick. */
async function pick(wrapper: ReturnType<typeof mountPicker>, file: File) {
  const input = wrapper.get('[data-testid="cover-input"]').element as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await wrapper.get('[data-testid="cover-input"]').trigger('change');
  await flushPromises();
}

function imageFile(type: string, size = 10): File {
  const file = new File([new Uint8Array(size)], 'copertina', { type });
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
}

describe('CoverPicker', () => {
  it('mostra il segnaposto senza copertina', () => {
    const wrapper = mountPicker();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('.app_icon').attributes('aria-label')).toBe('Nessuna copertina');
  });

  it('mostra la copertina attuale', () => {
    const wrapper = mountPicker('data:image/png;base64,AAA');

    expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,AAA');
  });

  it('emette l immagine scelta codificata in base64', async () => {
    const wrapper = mountPicker();

    await pick(wrapper, imageFile('image/png'));
    // FileReader resolves through its own event, outside the Vue tick.
    await vi.waitFor(() => expect(wrapper.emitted('select')).toHaveLength(1));
    await flushPromises();

    const emitted = wrapper.emitted('select');
    expect((emitted?.[0]?.[0] as { mimeType: string }).mimeType).toBe('image/png');
    expect(wrapper.get('img').attributes('src')).toContain('data:image/png;base64,');
  });

  it('rifiuta un formato non ammesso senza emettere nulla', async () => {
    const wrapper = mountPicker();

    await pick(wrapper, imageFile('image/gif'));

    expect(wrapper.emitted('select')).toBeUndefined();
    expect(wrapper.get('[role="alert"]').text()).toContain('PNG o JPEG');
  });

  it('rifiuta un immagine troppo grande', async () => {
    const wrapper = mountPicker();

    await pick(wrapper, imageFile('image/png', MAX_COVER_BYTES + 1));

    expect(wrapper.emitted('select')).toBeUndefined();
    expect(wrapper.get('[role="alert"]').text()).toContain('5 MB');
  });

  it('permette di rimuovere la copertina presente', async () => {
    const wrapper = mountPicker('data:image/png;base64,AAA');

    await wrapper.findAll('button')[1]?.trigger('click');

    expect(wrapper.emitted('remove')).toHaveLength(1);
    expect(wrapper.find('img').exists()).toBe(false);
  });

  it('non offre la rimozione quando non c e copertina', () => {
    const wrapper = mountPicker();

    expect(wrapper.findAll('button')[1]?.attributes('disabled')).toBeDefined();
  });
});
