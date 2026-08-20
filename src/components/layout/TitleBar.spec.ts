import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { APP_NAME } from '@/config/app-config';
import * as windowControls from '@/services/window-controls';
import { useNavigationStore } from '@/stores/navigation';

import TitleBar from './TitleBar.vue';

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
});

describe('TitleBar', () => {
  it('shows the app name', () => {
    const wrapper = mount(TitleBar, withPinia());

    expect(wrapper.get('.titlebar_name').text()).toBe(APP_NAME);
  });

  it('declares the draggable area to the window', () => {
    const wrapper = mount(TitleBar, withPinia());

    expect(wrapper.get('.titlebar_drag').attributes('data-tauri-drag-region')).toBeDefined();
  });

  it('exposes the three window commands with labels', () => {
    const wrapper = mount(TitleBar, withPinia());

    expect(wrapper.get('[data-testid="window-minimize"]').attributes('aria-label')).toBe(
      'Riduci a icona',
    );
    expect(wrapper.get('[data-testid="window-maximize"]').attributes('aria-label')).toBe(
      'Ingrandisci o ripristina',
    );
    expect(wrapper.get('[data-testid="window-close"]').attributes('aria-label')).toBe(
      "Chiudi l'applicazione",
    );
  });

  it('invokes the command matching each button', async () => {
    const minimize = vi.spyOn(windowControls, 'minimizeWindow').mockResolvedValue(true);
    const toggle = vi.spyOn(windowControls, 'toggleMaximizeWindow').mockResolvedValue(true);
    const close = vi.spyOn(windowControls, 'closeWindow').mockResolvedValue(true);
    const wrapper = mount(TitleBar, withPinia());

    await wrapper.get('[data-testid="window-minimize"]').trigger('click');
    await wrapper.get('[data-testid="window-maximize"]').trigger('click');
    await wrapper.get('[data-testid="window-close"]').trigger('click');

    expect(minimize).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('maximizes on double click on the bar', async () => {
    const toggle = vi.spyOn(windowControls, 'toggleMaximizeWindow').mockResolvedValue(true);
    const wrapper = mount(TitleBar, withPinia());

    await wrapper.get('.titlebar_drag').trigger('dblclick');

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('opens settings and toggles back', async () => {
    const options = withPinia();
    const navigation = useNavigationStore();
    const wrapper = mount(TitleBar, options);

    await wrapper.get('[data-testid="open-settings"]').trigger('click');
    expect(navigation.view).toBe('settings');

    await wrapper.get('[data-testid="open-settings"]').trigger('click');
    expect(navigation.view).toBe('library');
  });

  it('opens help and toggles back', async () => {
    const options = withPinia();
    const navigation = useNavigationStore();
    const wrapper = mount(TitleBar, options);

    await wrapper.get('[data-testid="open-help"]').trigger('click');
    expect(navigation.view).toBe('help');

    await wrapper.get('[data-testid="open-help"]').trigger('click');
    expect(navigation.view).toBe('library');
  });

  it('switches from settings to help without returning to the library', async () => {
    const options = withPinia();
    const navigation = useNavigationStore();
    navigation.go('settings');
    const wrapper = mount(TitleBar, options);

    await wrapper.get('[data-testid="open-help"]').trigger('click');

    expect(navigation.view).toBe('help');
  });

  it('reports when settings are open', async () => {
    const options = withPinia();
    useNavigationStore().go('settings');

    const wrapper = mount(TitleBar, options);
    const icona = wrapper.get('[data-testid="open-settings"]');

    expect(icona.attributes('aria-current')).toBe('page');
    expect(icona.classes()).toContain('titlebar_action_active');
  });
});
