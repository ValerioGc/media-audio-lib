<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import TitleBar from '@/components/layout/TitleBar.vue';
import PlayerDock from '@/components/player/PlayerDock.vue';
import { startupAudioFile } from '@/services/playback-api';
import {
  onMiniCommand,
  publishPlayerState,
  type MiniPlayerCommand,
} from '@/services/mini-player-bridge';
import { applyTrayMenu, closeMiniPlayer, onTrayStopPlayback } from '@/services/shell-integration';
import { useLibraryStore } from '@/stores/library';
import { quitApp, showWindow } from '@/services/window-controls';
import { useNavigationStore } from '@/stores/navigation';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import HelpView from '@/views/HelpView.vue';
import LibraryView from '@/views/LibraryView.vue';
import SettingsView from '@/views/SettingsView.vue';

const { t } = useI18n();
const library = useLibraryStore();
const settings = useSettingsStore();
const navigation = useNavigationStore();
const player = usePlayerStore();

/**
 * The tray menu is written by the shell, so it is handed the words of the interface and
 * the state of the player: with nothing loaded there is nothing to stop.
 */
async function writeTrayMenu() {
  await applyTrayMenu(t('tray.show'), t('tray.stop'), t('tray.quit'), player.isActive);
}

let stopTrayListener: (() => void) | null = null;
let miniCommandListener: (() => void) | null = null;

/**
 * What the dock draws, sent over on every change.
 *
 * The dock is a separate webview: it cannot reach the audio, which lives here, so it is
 * told what is playing and asks for the rest.
 */
async function publishToDock() {
  const track = player.currentTrack;

  if (track === null) {
    await publishPlayerState(null);
    return;
  }

  await publishPlayerState({
    title: track.title,
    artist: track.artist,
    cover: await library.loadCover(track),
    isPlaying: player.isPlaying,
    hasNext: player.hasNext,
    hasPrevious: player.hasPrevious,
    position: player.position,
    duration: player.duration,
    volume: player.volume,
    isMuted: player.isMuted,
    gradient:
      settings.miniPlayerGradient && player.coverAccent !== null
        ? player.coverAccent.surfaceGradient
        : null,
  });
}

async function runDockCommand({ action, value }: MiniPlayerCommand) {
  if (action === 'toggle') {
    await player.toggle();
    return;
  }

  if (action === 'next') {
    await player.next();
    return;
  }

  if (action === 'previous') {
    await player.previous();
    return;
  }

  if (action === 'stop') {
    player.stop();
    return;
  }

  if (action === 'seek') {
    player.seek(value ?? 0);
    return;
  }

  if (action === 'volume') {
    player.setVolume(value ?? 0);
    return;
  }

  if (action === 'mute') {
    player.toggleMute();
    return;
  }

  if (action === 'expand') {
    await closeMiniPlayer();
    await showWindow();
    return;
  }

  await quitApp();
}

async function initializeApp() {
  await settings.initialize();
  await writeTrayMenu();
  stopTrayListener = await onTrayStopPlayback(() => player.stop());
  miniCommandListener = await onMiniCommand((command) => {
    void runDockCommand(command);
  });

  // The system may have started the app out of sight: the window comes back unless the
  // settings ask it to wait in the tray.
  if (!settings.autostartMinimized) {
    await showWindow();
  }

  const startupTrack = await startupAudioFile();

  if (startupTrack !== null) {
    navigation.go('player');
    player.expand();
    await player.play(startupTrack);
  }
}

onMounted(initializeApp);

watch([() => settings.locale, () => player.isActive], writeTrayMenu);

// The dock follows the track, how far it has got, and everything it can act on.
watch(
  [
    () => player.currentTrack,
    () => player.isPlaying,
    () => player.hasNext,
    () => player.hasPrevious,
    () => Math.floor(player.position),
    () => player.volume,
    () => player.isMuted,
    () => player.coverAccent,
    () => settings.miniPlayerGradient,
  ],
  () => {
    void publishToDock();
  },
);

onBeforeUnmount(() => {
  stopTrayListener?.();
  stopTrayListener = null;
  miniCommandListener?.();
  miniCommandListener = null;
  settings.dispose();
});
</script>

<template>
  <div class="app_shell">
    <!-- The window is undecorated: this bar is both the system titlebar and the header. -->
    <TitleBar />

    <!-- The frame stands still and each view scrolls the region that owns its content. -->
    <main class="app_shell_content">
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

  // The frame is fixed: the library scrolls its list, the settings and the guide scroll
  // their own content, and nothing ever moves the page under the titlebar.
  &_content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: $page_gutter;
    overflow: hidden;
  }

  &_player_only {
    flex: 1;
  }
}
</style>
