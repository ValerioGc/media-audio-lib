import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppTooltip from '@/components/common/AppTooltip.vue';

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

  it('sits above the trigger and against its right edge by default', async () => {
    const wrapper = mount(AppTooltip, options);

    await wrapper.trigger('mouseenter');

    expect(wrapper.get('[role="tooltip"]').classes()).toContain('app_tooltip_bubble_top');
    expect(wrapper.get('[role="tooltip"]').classes()).toContain('app_tooltip_bubble_end');
  });

  it('can hang under the trigger, for the controls on the top edge', async () => {
    const wrapper = mount(AppTooltip, {
      ...options,
      props: { ...options.props, placement: 'bottom' as const, align: 'center' as const },
    });

    await wrapper.trigger('mouseenter');

    expect(wrapper.get('[role="tooltip"]').classes()).toContain('app_tooltip_bubble_bottom');
    expect(wrapper.get('[role="tooltip"]').classes()).toContain('app_tooltip_bubble_center');
  });

  it('also appears from keyboard, not only mouse', async () => {
    const wrapper = mount(AppTooltip, options);

    await wrapper.trigger('focusin');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true);

    await wrapper.trigger('focusout');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
  });
});
