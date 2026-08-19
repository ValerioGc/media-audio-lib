<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

import TitleBar from '@/components/layout/TitleBar.vue';
import PlayerDock from '@/components/player/PlayerDock.vue';
import { useNavigationStore } from '@/stores/navigation';
import { useSettingsStore } from '@/stores/settings';
import LibraryView from '@/views/LibraryView.vue';
import SettingsView from '@/views/SettingsView.vue';

const settings = useSettingsStore();
const navigation = useNavigationStore();

onMounted(() => {
  void settings.initialize();
});

onBeforeUnmount(() => {
  settings.dispose();
});
</script>

<template>
  <div class="app_shell">
    <!-- The window is undecorated: this bar is both the system titlebar and the header. -->
    <TitleBar />

    <main class="app_shell_content">
      <SettingsView v-if="navigation.isSettings" />
      <LibraryView v-else />
    </main>

    <PlayerDock />
  </div>
</template>

<style scoped lang="scss">
.app_shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100%;

  &_content {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: $space_lg;
    overflow-y: auto;
  }
}
</style>
