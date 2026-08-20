import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppOptionGroup from '@/components/common/AppOptionGroup.vue';

const options = [
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
];

describe('AppOptionGroup', () => {
  it('shows the legend and one radio per option', () => {
    const wrapper = mount(AppOptionGroup, {
      props: { modelValue: 'light', options, legend: 'Tema' },
    });

    expect(wrapper.get('legend').text()).toBe('Tema');
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2);
  });

  it('marks only the current option as selected', () => {
    const wrapper = mount(AppOptionGroup, {
      props: { modelValue: 'dark', options, legend: 'Tema' },
    });

    const items = wrapper.findAll('.app_option_group_item');

    expect(items[0]?.classes()).not.toContain('app_option_group_item_selected');
    expect(items[1]?.classes()).toContain('app_option_group_item_selected');
  });

  it('groups radios under the same name', () => {
    const wrapper = mount(AppOptionGroup, {
      props: { modelValue: 'light', options, legend: 'Tema' },
    });

    const names = wrapper.findAll('input').map((input) => input.attributes('name'));

    expect(new Set(names).size).toBe(1);
  });

  it('emits the chosen value', async () => {
    const wrapper = mount(AppOptionGroup, {
      props: { modelValue: 'light', options, legend: 'Tema' },
    });

    await wrapper.findAll('input')[1]?.trigger('change');

    expect(wrapper.emitted('update:modelValue')).toEqual([['dark']]);
  });
});
