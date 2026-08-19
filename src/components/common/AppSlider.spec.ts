import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n } from '../../../tests/support/mount';

import AppSlider from './AppSlider.vue';

beforeEach(() => {
  resetI18n();
});

describe('AppSlider', () => {
  it('espone i limiti richiesti', () => {
    const wrapper = mount(AppSlider, {
      props: { modelValue: 20, label: 'Volume', max: 200, step: 5 },
    });
    const campo = wrapper.get('input');

    expect(campo.attributes('type')).toBe('range');
    expect(campo.attributes('min')).toBe('0');
    expect(campo.attributes('max')).toBe('200');
    expect(campo.attributes('step')).toBe('5');
    expect((campo.element as HTMLInputElement).value).toBe('20');
  });

  it('emette un numero, non il testo del campo', async () => {
    const wrapper = mount(AppSlider, { props: { modelValue: 0, label: 'Volume' } });

    await wrapper.get('input').setValue('42');

    expect(wrapper.emitted('update:modelValue')).toEqual([[42]]);
  });

  it('collega l etichetta al campo e la puo nascondere', () => {
    const visibile = mount(AppSlider, { props: { modelValue: 0, label: 'Volume' } });
    const nascosta = mount(AppSlider, {
      props: { modelValue: 0, label: 'Volume', hideLabel: true },
    });

    expect(visibile.get('label').attributes('for')).toBe(visibile.get('input').attributes('id'));
    expect(visibile.get('label').classes()).not.toContain('app_slider_label_hidden');
    expect(nascosta.get('label').classes()).toContain('app_slider_label_hidden');
  });

  it('annuncia un valore leggibile quando fornito', () => {
    const wrapper = mount(AppSlider, {
      props: { modelValue: 30, label: 'Avanzamento', valueText: '0:30 / 3:05' },
    });

    expect(wrapper.get('input').attributes('aria-valuetext')).toBe('0:30 / 3:05');
  });

  it('non annuncia nulla di diverso senza testo', () => {
    const wrapper = mount(AppSlider, { props: { modelValue: 30, label: 'Avanzamento' } });

    expect(wrapper.get('input').attributes('aria-valuetext')).toBeUndefined();
  });

  it('puo essere disattivato', () => {
    const wrapper = mount(AppSlider, {
      props: { modelValue: 0, label: 'Avanzamento', disabled: true },
    });

    expect(wrapper.get('input').attributes('disabled')).toBeDefined();
  });
});
