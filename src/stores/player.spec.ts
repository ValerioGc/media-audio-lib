import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestPinia } from '../../tests/support/mount';
import { makeTrack } from '../../tests/support/tracks';

import { usePlayerStore } from './player';

beforeEach(() => {
  setActivePinia(createTestPinia());
});

describe('usePlayerStore', () => {
  it('parte senza nulla in riproduzione', () => {
    const player = usePlayerStore();

    expect(player.currentTrack).toBeNull();
    expect(player.isActive).toBe(false);
    expect(player.isExpanded).toBe(false);
  });

  it('carica il brano richiesto', () => {
    const player = usePlayerStore();
    const track = makeTrack();

    player.play(track);

    expect(player.currentTrack).toEqual(track);
    expect(player.isActive).toBe(true);
  });

  it('sostituisce il brano in riproduzione', () => {
    const player = usePlayerStore();
    const secondo = makeTrack();

    player.play(makeTrack());
    player.play(secondo);

    expect(player.currentTrack?.id).toBe(secondo.id);
  });

  it('espande e riduce il player', () => {
    const player = usePlayerStore();
    player.play(makeTrack());

    player.expand();
    expect(player.isExpanded).toBe(true);

    player.collapse();
    expect(player.isExpanded).toBe(false);

    player.toggleExpanded();
    expect(player.isExpanded).toBe(true);
  });

  it('chiudendo il player torna anche alla vista ridotta', () => {
    const player = usePlayerStore();
    player.play(makeTrack());
    player.expand();

    player.close();

    expect(player.currentTrack).toBeNull();
    expect(player.isActive).toBe(false);
    expect(player.isExpanded).toBe(false);
  });
});
