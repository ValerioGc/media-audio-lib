<script setup lang="ts">
import PlayerBar from '@/components/player/PlayerBar.vue';
import PlayerFullView from '@/components/player/PlayerFullView.vue';
import { usePlayerStore } from '@/stores/player';

const player = usePlayerStore();
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
