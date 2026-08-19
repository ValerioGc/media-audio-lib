import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { TrackView } from '@/types/library';

/**
 * What is currently loaded in the player dock. Actual audio playback lands in phase 8:
 * for now the store only tracks which piece is in the dock and how it is displayed.
 */
export const usePlayerStore = defineStore('player', () => {
  const currentTrack = ref<TrackView | null>(null);
  const isExpanded = ref(false);

  const isActive = computed(() => currentTrack.value !== null);

  /** Loads a track into the dock, which makes the bar appear at the bottom. */
  function play(track: TrackView) {
    currentTrack.value = track;
  }

  function close() {
    currentTrack.value = null;
    isExpanded.value = false;
  }

  function expand() {
    isExpanded.value = true;
  }

  function collapse() {
    isExpanded.value = false;
  }

  function toggleExpanded() {
    isExpanded.value = !isExpanded.value;
  }

  return {
    currentTrack,
    isExpanded,
    isActive,
    play,
    close,
    expand,
    collapse,
    toggleExpanded,
  };
});
