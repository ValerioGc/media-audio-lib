import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppInput from './AppInput.vue';

describe('AppInput', () => {
  it('collega la label al campo', () => {
    const wrapper = mount(AppInput, { props: { modelValue: '', label: 'Cerca' } });

    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('input').attributes('id'));
    expect(wrapper.get('label').text()).toBe('Cerca');
  });

  it('mantiene la label accessibile anche quando e nascosta', () => {
    const wrapper = mount(AppInput, {
      props: { modelValue: '', label: 'Cerca', hideLabel: true },
    });

    expect(wrapper.get('label').classes()).toContain('app_input_label_hidden');
    expect(wrapper.get('label').text()).toBe('Cerca');
  });

  it('emette il valore digitato', async () => {
    const wrapper = mount(AppInput, { props: { modelValue: '', label: 'Cerca' } });

    await wrapper.get('input').setValue('rock');

    expect(wrapper.emitted('update:modelValue')).toEqual([['rock']]);
  });

  it('applica tipo e placeholder', () => {
    const wrapper = mount(AppInput, {
      props: { modelValue: '', label: 'Cerca', type: 'search', placeholder: 'Titolo' },
    });

    expect(wrapper.get('input').attributes('type')).toBe('search');
    expect(wrapper.get('input').attributes('placeholder')).toBe('Titolo');
  });
});
