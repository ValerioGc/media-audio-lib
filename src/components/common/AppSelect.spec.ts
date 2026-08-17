import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppSelect from './AppSelect.vue';

const options = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'Inglese' },
];

describe('AppSelect', () => {
  it('mostra tutte le opzioni con la corrente selezionata', () => {
    const wrapper = mount(AppSelect, {
      props: { modelValue: 'en', options, label: 'Lingua' },
    });

    expect(wrapper.findAll('option')).toHaveLength(2);
    expect(wrapper.get('select').element.value).toBe('en');
  });

  it('collega la label al campo tramite id', () => {
    const wrapper = mount(AppSelect, {
      props: { modelValue: 'it', options, label: 'Lingua' },
    });

    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('select').attributes('id'));
    expect(wrapper.get('label').text()).toBe('Lingua');
  });

  it('emette il nuovo valore alla selezione', async () => {
    const wrapper = mount(AppSelect, {
      props: { modelValue: 'it', options, label: 'Lingua' },
    });

    await wrapper.get('select').setValue('en');

    expect(wrapper.emitted('update:modelValue')).toEqual([['en']]);
  });
});
