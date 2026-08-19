import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '../../../tests/support/mount';

import PlayerControls from './PlayerControls.vue';

beforeEach(() => {
  resetI18n();
});

function mountControls(props: Partial<InstanceType<typeof PlayerControls>['$props']> = {}) {
  return mount(PlayerControls, {
    ...withPinia(),
    props: {
      isPlaying: false,
      hasNext: true,
      isShuffleEnabled: false,
      isRepeatOneEnabled: false,
      ...props,
    },
  });
}

describe('PlayerControls', () => {
  it('emette il comando di ogni pulsante', async () => {
    const wrapper = mountControls();

    await wrapper.get('[data-testid="player-previous"]').trigger('click');
    await wrapper.get('[data-testid="player-toggle"]').trigger('click');
    await wrapper.get('[data-testid="player-stop"]').trigger('click');
    await wrapper.get('[data-testid="player-next"]').trigger('click');
    await wrapper.get('[data-testid="player-shuffle"]').trigger('click');
    await wrapper.get('[data-testid="player-repeat-one"]').trigger('click');

    expect(wrapper.emitted('previous')).toHaveLength(1);
    expect(wrapper.emitted('toggle')).toHaveLength(1);
    expect(wrapper.emitted('stop')).toHaveLength(1);
    expect(wrapper.emitted('next')).toHaveLength(1);
    expect(wrapper.emitted('toggleShuffle')).toHaveLength(1);
    expect(wrapper.emitted('toggleRepeatOne')).toHaveLength(1);
  });

  it('mostra riproduci quando e in pausa e pausa quando suona', async () => {
    const wrapper = mountControls();
    const pulsante = wrapper.get('[data-testid="player-toggle"]');

    expect(pulsante.attributes('aria-label')).toBe('Riproduci');
    expect(pulsante.get('.app_icon').classes()).toContain('app_icon_play');

    await wrapper.setProps({ isPlaying: true });

    expect(pulsante.attributes('aria-label')).toBe('Metti in pausa');
    expect(pulsante.get('.app_icon').classes()).toContain('app_icon_pause');
    expect(pulsante.attributes('aria-pressed')).toBe('true');
  });

  it('spegne il brano successivo alla fine della coda', () => {
    const wrapper = mountControls({ hasNext: false });

    expect(wrapper.get('[data-testid="player-next"]').attributes('disabled')).toBeDefined();
  });

  it('mostra shuffle e ripetizione come opzioni attive', () => {
    const wrapper = mountControls({ isShuffleEnabled: true, isRepeatOneEnabled: true });

    expect(wrapper.get('[data-testid="player-shuffle"]').classes()).toContain(
      'player_controls_mode_active',
    );
    expect(wrapper.get('[data-testid="player-shuffle"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-testid="player-repeat-one"]').classes()).toContain(
      'player_controls_mode_active',
    );
    expect(wrapper.get('[data-testid="player-repeat-one"]').attributes('aria-pressed')).toBe(
      'true',
    );
  });

  it('lascia disponibile il precedente anche sul primo brano', () => {
    const wrapper = mountControls();

    expect(wrapper.get('[data-testid="player-previous"]').attributes('disabled')).toBeUndefined();
  });

  it('blocca i comandi mentre il brano viene caricato', () => {
    const wrapper = mountControls({ disabled: true });

    expect(wrapper.get('[data-testid="player-toggle"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="player-stop"]').attributes('disabled')).toBeDefined();
  });
});
