import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import App from './App.vue';
import { APP_NAME } from './config/app-config';

describe('App', () => {
  it('monta la shell mostrando il nome dell applicazione', () => {
    const wrapper = mount(App);

    expect(wrapper.find('.app_shell_title').text()).toBe(APP_NAME);
  });

  it('segnala il runtime corrente', () => {
    const wrapper = mount(App);

    expect(wrapper.get('[data-testid="runtime"]').text()).toBe('Browser');
  });
});
