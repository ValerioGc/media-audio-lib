import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import type { MenuItem } from '@/types/menu';

import AppMenu from './AppMenu.vue';

const wrappers: VueWrapper[] = [];

const items: MenuItem[] = [
  { id: 'rename', label: 'Rinomina', icon: 'edit' },
  { id: 'export', label: 'Esporta', icon: 'export', disabled: true },
  { id: 'delete', label: 'Elimina', icon: 'remove', danger: true },
];

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});

function mountMenu() {
  const wrapper = mount(AppMenu, {
    ...withPinia(),
    props: { items, label: 'Opzioni' },
    attachTo: document.body,
  });
  wrappers.push(wrapper);

  return wrapper;
}

describe('AppMenu', () => {
  it('tiene il pannello chiuso finche non viene aperto', () => {
    const wrapper = mountMenu();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(wrapper.get('.app_menu_trigger').attributes('aria-label')).toBe('Opzioni');
  });

  it('emette l identificativo della voce scelta', async () => {
    const wrapper = mountMenu();

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[2]?.trigger('click');

    expect(wrapper.emitted('select')).toEqual([['delete']]);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('ignora le voci disattivate', async () => {
    const wrapper = mountMenu();

    await wrapper.get('.app_menu_trigger').trigger('click');
    const disabilitata = wrapper.findAll('.app_menu_item')[1];

    expect(disabilitata?.attributes('disabled')).toBeDefined();

    await disabilitata?.trigger('click');

    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('sposta il fuoco sulla prima voce utilizzabile', async () => {
    const wrapper = mountMenu();

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.findAll('.app_menu_item')[0]?.element);
  });

  it('chiude il menu con Escape e al click fuori', async () => {
    const wrapper = mountMenu();

    await wrapper.get('.app_menu_trigger').trigger('click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);

    await wrapper.get('.app_menu_trigger').trigger('click');
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('apre il menu con la freccia giu', async () => {
    const wrapper = mountMenu();

    await wrapper.get('.app_menu_trigger').trigger('keydown', { key: 'ArrowDown' });

    expect(wrapper.find('[role="menu"]').exists()).toBe(true);
  });
});
