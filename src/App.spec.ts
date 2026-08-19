import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestPinia, resetI18n } from '../tests/support/mount';
import { makeTrack } from '../tests/support/tracks';
import { i18n } from '@/i18n';
import { useNavigationStore } from '@/stores/navigation';
import { usePlayerStore } from '@/stores/player';
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

async function mountApp() {
  const wrapper = mount(App, { global: { plugins: [createTestPinia(), i18n] } });
  await flushPromises();

  return wrapper;
}

describe('App', () => {
  it('mostra la titlebar personalizzata al posto di quella di sistema', async () => {
    const wrapper = await mountApp();

    expect(wrapper.get('.titlebar_name').text()).toBe('Media Audio Lib');
    expect(wrapper.find('[data-testid="window-close"]').exists()).toBe(true);
  });

  it('parte dalla libreria', async () => {
    const wrapper = await mountApp();

    expect(wrapper.find('.library_view').exists()).toBe(true);
    expect(wrapper.find('.settings_view').exists()).toBe(false);
  });

  it('apre le impostazioni dall icona nella titlebar', async () => {
    const wrapper = await mountApp();

    await wrapper.get('[data-testid="open-settings"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('.settings_view_title').text()).toBe('Impostazioni');
    expect(wrapper.find('.library_view').exists()).toBe(false);
  });

  it('dalla stessa icona si torna alla libreria', async () => {
    const wrapper = await mountApp();
    useNavigationStore().go('settings');
    await flushPromises();

    await wrapper.get('[data-testid="open-settings"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('.settings_view').exists()).toBe(false);
    expect(wrapper.find('.library_view').exists()).toBe(true);
  });

  it('mostra il player in basso solo quando c e qualcosa in riproduzione', async () => {
    const wrapper = await mountApp();

    expect(wrapper.find('.player_bar').exists()).toBe(false);

    usePlayerStore().play(makeTrack({ title: 'Brano' }));
    await flushPromises();

    expect(wrapper.get('.player_bar_title').text()).toBe('Brano');
  });

  it('rilascia l ascolto del tema di sistema allo smontaggio', async () => {
    const wrapper = await mountApp();
    const dispose = vi.spyOn(useSettingsStore(), 'dispose');

    wrapper.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('applica al documento le impostazioni salvate', async () => {
    await mountApp();

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.lang).toBe('it');
  });
});
