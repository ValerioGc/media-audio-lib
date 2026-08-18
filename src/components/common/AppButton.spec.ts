import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppButton from './AppButton.vue';

describe('AppButton', () => {
  it('rende il contenuto dello slot', () => {
    const wrapper = mount(AppButton, { slots: { default: 'Aggiungi' } });

    expect(wrapper.text()).toBe('Aggiungi');
  });

  it('usa la variante neutra per impostazione predefinita', () => {
    const wrapper = mount(AppButton);

    expect(wrapper.classes()).toContain('app_button_neutral');
    expect(wrapper.attributes('type')).toBe('button');
  });

  it('applica la variante richiesta', () => {
    const wrapper = mount(AppButton, { props: { variant: 'danger' } });

    expect(wrapper.classes()).toContain('app_button_danger');
  });

  it('emette il click quando e abilitato', async () => {
    const wrapper = mount(AppButton);

    await wrapper.trigger('click');

    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('non emette nulla da disabilitato', async () => {
    const wrapper = mount(AppButton, { props: { disabled: true } });

    await wrapper.trigger('click');

    expect(wrapper.attributes('disabled')).toBeDefined();
    expect(wrapper.emitted('click')).toBeUndefined();
  });
});
