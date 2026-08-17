import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppPlaceholder from './AppPlaceholder.vue';

describe('AppPlaceholder', () => {
  it('mostra titolo e messaggio ricevuti', () => {
    const wrapper = mount(AppPlaceholder, {
      props: { title: 'Libreria', message: 'In arrivo' },
    });

    expect(wrapper.get('.app_placeholder_title').text()).toBe('Libreria');
    expect(wrapper.get('.app_placeholder_message').text()).toBe('In arrivo');
  });
});
