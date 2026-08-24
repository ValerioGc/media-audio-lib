<script setup lang="ts">
import { computed, watch } from 'vue';

import PlayerBar from '@/components/player/PlayerBar.vue';
import PlayerFullView from '@/components/player/PlayerFullView.vue';
import { dominantCoverAccent } from '@/services/cover-accent';
import { useLibraryStore } from '@/stores/library';
import { useNavigationStore } from '@/stores/navigation';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';

const library = useLibraryStore();
const navigation = useNavigationStore();
const player = usePlayerStore();
const settings = useSettingsStore();

/**
 * The player is part of the library, not of the pages read over it: settings and help take
 * the whole window, so the dock steps aside there. Only the view goes: the engine lives in
 * the store and keeps playing.
 */
const isCovered = computed(() => navigation.isSettings || navigation.isHelp);

watch(isCovered, (covered) => {
  if (covered) {
    player.collapse();
  }
});

let accentRequest = 0;

watch(
  [
    () => player.currentTrack,
    () => settings.coverGradientEnabled,
    () => settings.miniPlayerGradient,
    () => settings.coverGradientIntensity,
    () => settings.coverGradientStyle,
    () => settings.coverGradientDirection,
  ],
  async ([track, enabled, miniEnabled, intensity, style, direction]) => {
    const request = ++accentRequest;
    player.setCoverAccent(null);

    if ((!enabled && !miniEnabled) || track === null || track.missing) {
      return;
    }

    const source = library.coverUrl(track);

    if (request !== accentRequest || source === null) {
      return;
    }

    const accent = await dominantCoverAccent(source, { intensity, style, direction });

    if (request === accentRequest) {
      player.setCoverAccent(accent);
    }
  },
  { immediate: true },
);

function openLibraryFromPlayer() {
  navigation.go('library');
  player.collapse();
}

function closePlayer() {
  // The bar can outlive the track it was opened for: the queue stays, the sound stops.
  //
  // Only from the full view, though. Asked from the bar there is nothing smaller left to
  // fall back to, and answering with a collapse it is already in reads as no answer at all.
  if (settings.keepPlayerOpen && player.isExpanded) {
    player.stop();
    player.collapse();
  } else {
    player.close();
  }

  if (navigation.isPlayer) {
    navigation.go('library');
  }
}
</script>

<template>
  <!-- Nothing is shown until a track is loaded: the dock only exists while playing. -->
  <template v-if="player.currentTrack !== null && !isCovered">
    <PlayerFullView
      v-if="player.isExpanded"
      :track="player.currentTrack"
      :show-library-link="navigation.isPlayer"
      @collapse="player.collapse()"
      @open-library="openLibraryFromPlayer"
      @close="closePlayer"
    />
    <PlayerBar v-else :track="player.currentTrack" @expand="player.expand()" @close="closePlayer" />
  </template>
</template>
