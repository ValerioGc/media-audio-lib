<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

import TitleBar from '@/components/layout/TitleBar.vue';
import PlayerDock from '@/components/player/PlayerDock.vue';
import { startupAudioFile } from '@/services/playback-api';
import { useNavigationStore } from '@/stores/navigation';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import HelpView from '@/views/HelpView.vue';
import LibraryView from '@/views/LibraryView.vue';
import SettingsView from '@/views/SettingsView.vue';

const settings = useSettingsStore();
const navigation = useNavigationStore();
const player = usePlayerStore();

async function initializeApp() {
  await settings.initialize();

  const startupTrack = await startupAudioFile();

  if (startupTrack !== null) {
    navigation.go('player');
    player.expand();
    await player.play(startupTrack);
  }
}

onMounted(initializeApp);

onBeforeUnmount(() => {
  settings.dispose();
});
</script>

<template>
  <div class="app_shell">
    <!-- The window is undecorated: this bar is both the system titlebar and the header. -->
    <TitleBar />

    <main
      class="app_shell_content"
      :class="{ app_shell_content_locked: navigation.isLibrary || navigation.isPlayer }"
    >
      <SettingsView v-if="navigation.isSettings" />
      <HelpView v-else-if="navigation.isHelp" />
      <div v-else-if="navigation.isPlayer" class="app_shell_player_only" />
      <LibraryView v-else />
    </main>

    <PlayerDock />
  </div>
</template>

<style scoped lang="scss">
.app_shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;

  // The window itself never scrolls: the shell is a fixed frame and every view scrolls
  // the region that owns its content.
  overflow: hidden;

  &_content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: $page_gutter;

    @include scroll_area;
  }

  // The library fills the frame and scrolls the list or the grid from the inside, so the
  // toolbar, the sections and the player stay where they are.
  &_content_locked {
    overflow: hidden;
  }

  &_player_only {
    flex: 1;
  }
}
</style>
