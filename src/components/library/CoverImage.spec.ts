import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { makeTrack } from '../../../tests/support/tracks';
import { useLibraryStore } from '@/stores/library';

import CoverImage from './CoverImage.vue';

const scope = globalThis as unknown as Record<string, unknown>;
const originalObserver = scope.IntersectionObserver;

/** An observer that never reports the element as visible. */
class NeverVisibleObserver {
  static observed: Element[] = [];

  observe(target: Element) {
    NeverVisibleObserver.observed.push(target);
  }

  unobserve() {}
  disconnect() {}

  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  resetI18n();
  NeverVisibleObserver.observed = [];
});

afterEach(() => {
  scope.IntersectionObserver = originalObserver;
});

describe('CoverImage', () => {
  it('mostra un segnaposto quando il brano non ha copertina', async () => {
    const wrapper = mount(CoverImage, {
      ...withPinia(),
      props: { track: makeTrack({ hasCover: false }) },
    });
    await flushPromises();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('.cover_image_fallback').attributes('aria-label')).toBe('Nessuna copertina');
  });

  it('mostra la copertina caricata dallo store', async () => {
    const options = withPinia();
    vi.spyOn(useLibraryStore(), 'loadCover').mockResolvedValue('data:image/png;base64,AAA');

    const wrapper = mount(CoverImage, { ...options, props: { track: makeTrack() } });
    await flushPromises();

    expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,AAA');
  });

  it('applica la dimensione richiesta', () => {
    const wrapper = mount(CoverImage, {
      ...withPinia(),
      props: { track: makeTrack(), size: 'card' },
    });

    expect(wrapper.classes()).toContain('cover_image_card');
  });

  it('non carica nulla finche l immagine resta fuori dallo schermo', async () => {
    scope.IntersectionObserver = NeverVisibleObserver;
    const options = withPinia();
    const loadCover = vi.spyOn(useLibraryStore(), 'loadCover').mockResolvedValue(null);

    mount(CoverImage, { ...options, props: { track: makeTrack() } });
    await flushPromises();

    expect(NeverVisibleObserver.observed).toHaveLength(1);
    expect(loadCover).not.toHaveBeenCalled();
  });

  it('carica subito quando e dichiarata prioritaria', async () => {
    scope.IntersectionObserver = NeverVisibleObserver;
    const options = withPinia();
    const loadCover = vi.spyOn(useLibraryStore(), 'loadCover').mockResolvedValue(null);

    mount(CoverImage, { ...options, props: { track: makeTrack(), eager: true } });
    await flushPromises();

    expect(NeverVisibleObserver.observed).toHaveLength(0);
    expect(loadCover).toHaveBeenCalledTimes(1);
  });

  it('ricarica la copertina quando cambia il brano', async () => {
    const options = withPinia();
    const loadCover = vi.spyOn(useLibraryStore(), 'loadCover').mockResolvedValue(null);

    const wrapper = mount(CoverImage, { ...options, props: { track: makeTrack() } });
    await flushPromises();
    await wrapper.setProps({ track: makeTrack() });
    await flushPromises();

    expect(loadCover).toHaveBeenCalledTimes(2);
  });
});
