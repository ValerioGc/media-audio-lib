import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestPinia, createTestRouter, resetI18n } from '../tests/support/mount';
import { i18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';

import App from './App.vue';

beforeEach(() => {
  resetI18n();
  localStorage.setItem(
    'app-settings',
    JSON.stringify({ locale: 'it', textSize: 'medium', theme: 'light' }),
  );
});

afterEach(() => {
  localStorage.clear();
});

async function mountApp(path = '/settings') {
  const router = createTestRouter();
  await router.push(path);
  await router.isReady();

  const wrapper = mount(App, { global: { plugins: [createTestPinia(), i18n, router] } });
  await flushPromises();

  return wrapper;
}

describe('App', () => {
  it('mostra il nome dell applicazione e la navigazione', async () => {
    const wrapper = await mountApp();

    expect(wrapper.get('.app_shell_brand').text()).toBe('Media Audio Lib');
    expect(wrapper.findAll('.app_navigation_link')).toHaveLength(3);
  });

  it('rende la vista corrispondente alla rotta', async () => {
    const wrapper = await mountApp('/settings');

    expect(wrapper.get('.settings_view_title').text()).toBe('Impostazioni');
  });

  it('rilascia l ascolto del tema di sistema allo smontaggio', async () => {
    const wrapper = await mountApp('/library');
    const dispose = vi.spyOn(useSettingsStore(), 'dispose');

    wrapper.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('applica al documento le impostazioni salvate', async () => {
    await mountApp('/library');

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.lang).toBe('it');
  });
});
