import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { ICON_GLYPHS } from '@/config/icons';

import AppIcon from './AppIcon.vue';

describe('AppIcon', () => {
  it('rende il glifo del nome richiesto', () => {
    const wrapper = mount(AppIcon, { props: { name: 'remove' } });

    expect(wrapper.text()).toBe(ICON_GLYPHS.remove);
  });

  it('resta decorativo quando non ha etichetta', () => {
    const wrapper = mount(AppIcon, { props: { name: 'note' } });

    expect(wrapper.attributes('aria-hidden')).toBe('true');
    expect(wrapper.attributes('role')).toBeUndefined();
    expect(wrapper.attributes('aria-label')).toBeUndefined();
  });

  it('diventa un immagine annunciata quando riceve un etichetta', () => {
    const wrapper = mount(AppIcon, { props: { name: 'note', label: 'Nessuna copertina' } });

    expect(wrapper.attributes('role')).toBe('img');
    expect(wrapper.attributes('aria-label')).toBe('Nessuna copertina');
    expect(wrapper.attributes('aria-hidden')).toBeUndefined();
  });

  it('espone una classe per ogni icona', () => {
    const wrapper = mount(AppIcon, { props: { name: 'sortAsc' } });

    expect(wrapper.classes()).toContain('app_icon_sortAsc');
  });
});
