import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppTooltip from './AppTooltip.vue';

const options = {
  props: { text: 'Rimuovi dalla libreria' },
  slots: { default: '<button>✕</button>' },
};

describe('AppTooltip', () => {
  it('resta nascosto finche non c e interazione', () => {
    const wrapper = mount(AppTooltip, options);

    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
    expect(wrapper.get('button').text()).toBe('✕');
  });

  it('compare al passaggio del mouse e sparisce all uscita', async () => {
    const wrapper = mount(AppTooltip, options);

    await wrapper.trigger('mouseenter');
    expect(wrapper.get('[role="tooltip"]').text()).toBe('Rimuovi dalla libreria');

    await wrapper.trigger('mouseleave');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
  });

  it('compare anche da tastiera, non solo col mouse', async () => {
    const wrapper = mount(AppTooltip, options);

    await wrapper.trigger('focusin');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true);

    await wrapper.trigger('focusout');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
  });
});
