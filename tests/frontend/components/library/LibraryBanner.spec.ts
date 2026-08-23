import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useSettingsStore } from '@/stores/settings';

import LibraryBanner from '@/components/library/LibraryBanner.vue';

beforeEach(() => {
  resetI18n();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function mountBanner(props: Record<string, unknown> = {}, duration = 5) {
  const options = withPinia();
  const settings = useSettingsStore();
  // The timer is set on mount, so the preference has to be in place before that.
  settings.bannerDuration = duration as typeof settings.bannerDuration;

  return {
    settings,
    wrapper: mount(LibraryBanner, { ...options, props, slots: { default: 'Something happened' } }),
  };
}

describe('LibraryBanner', () => {
  it('reads from the left, symbol first', () => {
    const { wrapper } = mountBanner();

    expect(wrapper.get('.library_banner_message').text()).toBe('Something happened');
    expect(wrapper.get('.library_banner_icon .app_icon').classes()).toContain('app_icon_info');
    expect(wrapper.attributes('role')).toBe('status');
  });

  it('takes its tone and its symbol from the caller', () => {
    const { wrapper } = mountBanner({ tone: 'warning', alert: true });

    expect(wrapper.classes()).toContain('library_banner_warning');
    expect(wrapper.get('.library_banner_icon .app_icon').classes()).toContain('app_icon_warning');
    expect(wrapper.attributes('role')).toBe('alert');
  });

  it('closes itself after the time set in the preferences', () => {
    const { wrapper } = mountBanner();

    const countdown = wrapper.get('[data-testid="library-banner-countdown"]');

    expect(countdown.attributes('style')).toContain('5000ms');

    vi.advanceTimersByTime(4999);

    expect(wrapper.emitted('dismiss')).toBeUndefined();

    vi.advanceTimersByTime(1);

    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });

  it('stays put when the preferences ask for no timer', () => {
    const { wrapper } = mountBanner({}, 0);

    vi.advanceTimersByTime(60_000);

    expect(wrapper.find('[data-testid="library-banner-countdown"]').exists()).toBe(false);
    expect(wrapper.emitted('dismiss')).toBeUndefined();
  });

  it('never closes a banner that reports a state rather than an event', () => {
    const { wrapper } = mountBanner({ dismissible: false });

    expect(wrapper.find('[data-testid="library-banner-dismiss"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="library-banner-countdown"]').exists()).toBe(false);

    vi.advanceTimersByTime(60_000);

    expect(wrapper.emitted('dismiss')).toBeUndefined();
  });

  it('closes on demand', async () => {
    const { wrapper } = mountBanner();

    await wrapper.get('[data-testid="library-banner-dismiss"]').trigger('click');

    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });
});
