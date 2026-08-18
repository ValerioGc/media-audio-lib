import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import MetadataField from './MetadataField.vue';

describe('MetadataField', () => {
  it('collega la label al campo', () => {
    const wrapper = mount(MetadataField, { props: { modelValue: '', label: 'Nome' } });

    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('input').attributes('id'));
  });

  it('emette il valore digitato', async () => {
    const wrapper = mount(MetadataField, { props: { modelValue: '', label: 'Nome' } });

    await wrapper.get('input').setValue('Brano');

    expect(wrapper.emitted('update:modelValue')).toEqual([['Brano']]);
  });

  it('non segnala errori quando il campo e valido', () => {
    const wrapper = mount(MetadataField, { props: { modelValue: 'Brano', label: 'Nome' } });

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('false');
  });

  it('annuncia l errore e lo collega al campo', () => {
    const wrapper = mount(MetadataField, {
      props: { modelValue: '', label: 'Nome', error: 'Il nome non può essere vuoto.' },
    });

    const alert = wrapper.get('[role="alert"]');

    expect(alert.text()).toBe('Il nome non può essere vuoto.');
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('input').attributes('aria-describedby')).toBe(alert.attributes('id'));
    expect(wrapper.get('input').classes()).toContain('metadata_field_input_invalid');
  });
});
