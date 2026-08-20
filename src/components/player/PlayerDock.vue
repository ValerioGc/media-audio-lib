<script setup lang="ts">
import { watch } from 'vue';

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

let accentRequest = 0;

watch(
  [
    () => player.currentTrack,
    () => settings.coverGradientEnabled,
    () => settings.coverGradientIntensity,
  ],
  async ([track, enabled, intensity]) => {
    const request = ++accentRequest;
    player.setCoverAccent(null);

    if (!enabled || track === null || track.missing) {
      return;
    }

    const source = await library.loadCover(track);

    if (request !== accentRequest || source === null) {
      return;
    }

    const accent = await dominantCoverAccent(source, intensity);

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
  player.close();

  if (navigation.isPlayer) {
    navigation.go('library');
  }
}
</script>

<template>
  <!-- Nothing is shown until a track is loaded: the dock only exists while playing. -->
  <template v-if="player.currentTrack !== null">
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
