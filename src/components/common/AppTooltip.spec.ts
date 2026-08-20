import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppTooltip from './AppTooltip.vue';

const options = {
  props: { text: 'Remove from library' },
  slots: { default: '<button>✕</button>' },
};

describe('AppTooltip', () => {
  it('stays hidden until interaction', () => {
    const wrapper = mount(AppTooltip, options);

    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
    expect(wrapper.get('button').text()).toBe('✕');
  });

  it('appears on mouse hover and disappears on leave', async () => {
    const wrapper = mount(AppTooltip, options);

    await wrapper.trigger('mouseenter');
    expect(wrapper.get('[role="tooltip"]').text()).toBe('Remove from library');

    await wrapper.trigger('mouseleave');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
  });

  it('also appears from keyboard, not only mouse', async () => {
    const wrapper = mount(AppTooltip, options);

    await wrapper.trigger('focusin');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true);

    await wrapper.trigger('focusout');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
  });
});
