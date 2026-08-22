import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';

import CoverCachePanel from '@/components/settings/CoverCachePanel.vue';

const mocks = vi.hoisted(() => ({
  coverCacheSize: vi.fn(),
  clearCoverCache: vi.fn(),
}));

vi.mock('@/services/library-api', () => ({
  coverCacheSize: mocks.coverCacheSize,
  clearCoverCache: mocks.clearCoverCache,
}));

const MEGABYTE = 1024 * 1024;

beforeEach(() => {
  resetI18n();
  mocks.coverCacheSize.mockReset();
  mocks.clearCoverCache.mockReset();
  mocks.coverCacheSize.mockResolvedValue({ bytes: 3 * MEGABYTE, limitBytes: 256 * MEGABYTE });
  mocks.clearCoverCache.mockResolvedValue({ bytes: 0, limitBytes: 256 * MEGABYTE });
});

async function mountPanel() {
  const wrapper = mount(CoverCachePanel, withPinia());
  await flushPromises();

  return wrapper;
}

describe('CoverCachePanel', () => {
  it('shows what the cache weighs and the limit it is kept under', async () => {
    const wrapper = await mountPanel();

    expect(wrapper.get('[data-testid="cover-cache-size"]').text()).toContain('3,0 MB');
    expect(wrapper.text()).toContain('256,0 MB');
  });

  it('empties the cache and says so', async () => {
    const wrapper = await mountPanel();

    await wrapper.get('[data-testid="clear-cover-cache"]').trigger('click');
    await flushPromises();

    expect(mocks.clearCoverCache).toHaveBeenCalled();
    expect(wrapper.get('[data-testid="cover-cache-size"]').text()).toContain('vuota');
    expect(wrapper.get('output').text()).toContain('svuotata');
  });

  it('offers nothing to empty when there is nothing cached', async () => {
    mocks.coverCacheSize.mockResolvedValue({ bytes: 0, limitBytes: 256 * MEGABYTE });

    const wrapper = await mountPanel();

    expect(wrapper.get('[data-testid="clear-cover-cache"]').attributes('disabled')).toBeDefined();
  });

  it('says nothing rather than a wrong number when the size cannot be read', async () => {
    mocks.coverCacheSize.mockRejectedValue(new Error('shell-unavailable'));

    const wrapper = await mountPanel();

    expect(wrapper.get('[data-testid="cover-cache-size"]').text()).toContain('vuota');
    // Without a limit from the shell there is no figure to quote for it.
    expect(wrapper.find('.cover_cache_panel_hint').exists()).toBe(false);
  });
});
