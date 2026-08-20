<script setup lang="ts">
import { watch } from 'vue';

import PlayerBar from '@/components/player/PlayerBar.vue';
import PlayerFullView from '@/components/player/PlayerFullView.vue';
import { dominantCoverAccent } from '@/services/cover-accent';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';

const library = useLibraryStore();
const player = usePlayerStore();
const settings = useSettingsStore();

let accentRequest = 0;

watch(
  [() => player.currentTrack, () => settings.coverGradientEnabled],
  async ([track, enabled]) => {
    const request = ++accentRequest;
    player.setCoverAccent(null);

    if (!enabled || track === null || track.missing) {
      return;
    }

    const source = await library.loadCover(track);

    if (request !== accentRequest || source === null) {
      return;
    }

    const accent = await dominantCoverAccent(source);

    if (request === accentRequest) {
      player.setCoverAccent(accent);
    }
  },
  { immediate: true },
);
</script>

<template>
  <!-- Nothing is shown until a track is loaded: the dock only exists while playing. -->
  <template v-if="player.currentTrack !== null">
    <PlayerFullView
      v-if="player.isExpanded"
      :track="player.currentTrack"
      @collapse="player.collapse()"
      @close="player.close()"
    />
    <PlayerBar
      v-else
      :track="player.currentTrack"
      @expand="player.expand()"
      @close="player.close()"
    />
  </template>
</template>
