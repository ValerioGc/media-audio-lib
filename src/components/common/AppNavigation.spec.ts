import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestRouter, resetI18n } from '../../../tests/support/mount';
import { i18n } from '@/i18n';

import AppNavigation from './AppNavigation.vue';

beforeEach(() => {
  resetI18n();
});

async function mountNavigation(path: string) {
  const router = createTestRouter();
  await router.push(path);
  await router.isReady();

  return mount(AppNavigation, { global: { plugins: [i18n, router] } });
}

describe('AppNavigation', () => {
  it('espone un collegamento per ogni sezione', async () => {
    const wrapper = await mountNavigation('/library');

    expect(wrapper.findAll('a').map((link) => link.text())).toEqual([
      'Libreria',
      'Player',
      'Impostazioni',
    ]);
  });

  it('evidenzia la sezione attiva', async () => {
    const wrapper = await mountNavigation('/settings');

    const active = wrapper.findAll('.app_navigation_link_active');

    expect(active).toHaveLength(1);
    expect(active[0]?.text()).toBe('Impostazioni');
  });

  it('dichiara un nome accessibile per la navigazione', async () => {
    const wrapper = await mountNavigation('/library');

    expect(wrapper.get('nav').attributes('aria-label')).toBe("Sezioni dell'applicazione");
  });
});
