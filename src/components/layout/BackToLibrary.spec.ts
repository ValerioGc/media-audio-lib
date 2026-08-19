import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';
import { useNavigationStore } from '@/stores/navigation';

import BackToLibrary from './BackToLibrary.vue';

beforeEach(() => {
  resetI18n();
});

describe('BackToLibrary', () => {
  it('dice dove porta', () => {
    const wrapper = mount(BackToLibrary, withPinia());

    expect(wrapper.text()).toContain('Torna alla libreria');
  });

  it('apre la libreria da qualunque vista', async () => {
    const options = withPinia();
    const navigation = useNavigationStore();
    navigation.go('settings');
    const wrapper = mount(BackToLibrary, options);

    await wrapper.trigger('click');

    expect(navigation.view).toBe('library');
  });
});
