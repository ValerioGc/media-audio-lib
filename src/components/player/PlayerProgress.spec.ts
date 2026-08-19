import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';

import PlayerProgress from './PlayerProgress.vue';

beforeEach(() => {
  resetI18n();
});

function mountProgress(position: number, duration: number) {
  return mount(PlayerProgress, { ...withPinia(), props: { position, duration } });
}

describe('PlayerProgress', () => {
  it('mostra il tempo trascorso e la durata', () => {
    const wrapper = mountProgress(65, 185);

    expect(wrapper.get('[data-testid="player-position"]').text()).toBe('1:05');
    expect(wrapper.get('[data-testid="player-duration"]').text()).toBe('3:05');
  });

  it('chiede la nuova posizione in secondi', async () => {
    const wrapper = mountProgress(0, 185);

    await wrapper.get('input').setValue('42');

    expect(wrapper.emitted('seek')).toEqual([[42]]);
  });

  it('usa la durata come limite della barra', () => {
    const wrapper = mountProgress(10, 185);

    expect(wrapper.get('input').attributes('max')).toBe('185');
    expect(wrapper.get('input').attributes('aria-valuetext')).toBe('0:10 / 3:05');
  });

  it('non lascia cercare in un brano di durata sconosciuta', () => {
    const wrapper = mountProgress(0, 0);

    expect(wrapper.get('input').attributes('disabled')).toBeDefined();
  });
});
