<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/AppModal.vue';
import PlayerProgress from '@/components/player/PlayerProgress.vue';
import PlayerVolume from '@/components/player/PlayerVolume.vue';
import {
  onMiniCloseDecision,
  onPlayerState,
  sendMiniCommand,
  type MiniPlayerState,
} from '@/services/mini-player-bridge';
import { closeMiniPlayer, openMiniCloseConfirmation } from '@/services/shell-integration';
import { onWindowMoved, windowPosition } from '@/services/window-controls';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();

const state = ref<MiniPlayerState | null>(null);
const isClosing = ref(false);
const isSheetOpen = ref(false);
const remembers = ref(false);
let unlistenState: (() => void) | null = null;
let unlistenMoved: (() => void) | null = null;
let unlistenCloseDecision: (() => void) | null = null;

const isVertical = computed(() => settings.miniPlayerOrientation === 'vertical');
const isExpanded = computed(() => settings.miniPlayerLevel === 'expanded');

/** The colour of the cover, painted behind the dock when the setting asks for it. */
const gradientStyle = computed(() =>
  state.value?.gradient === null || state.value === null
    ? {}
    : { '--dock_gradient': state.value.gradient },
);

/** How far along the track is, as the share of the bar that is filled. */
const progressStyle = computed(() => {
  const duration = state.value?.duration ?? 0;
  const share = duration > 0 ? ((state.value?.position ?? 0) / duration) * 100 : 0;

  return { '--mini_progress': `${Math.min(100, Math.max(0, share))}%` };
});

onMounted(async () => {
  // The dock reads the same settings file as the app, so theme, accent and text size follow.
  await settings.initialize();
  unlistenState = await onPlayerState((received) => {
    state.value = received;
  });
  unlistenCloseDecision = await onMiniCloseDecision((decision) => {
    close(decision.quitsApp, decision.remember).catch((error: unknown) => {
      console.error('Closing the mini player from the confirmation window failed', error);
    });
  });

  // The state event may have been emitted before this separate webview started listening.
  // Asking for a fresh snapshot also carries the cover gradient into a newly opened dock.
  await sendMiniCommand('sync');

  // Wherever it is left is where it comes back: the position is written down as it moves.
  unlistenMoved = await onWindowMoved((position) => {
    settings.setMiniPlayerPosition(position).catch((error: unknown) => {
      console.error('Writing down the dock position failed', error);
    });
  });
});

onBeforeUnmount(() => {
  unlistenState?.();
  unlistenMoved?.();
  unlistenCloseDecision?.();
  unlistenState = null;
  unlistenMoved = null;
  unlistenCloseDecision = null;
  settings.dispose();
});

/** The second level is a choice of the moment, unless the settings ask to keep it. */
async function toggleLevel() {
  await settings.setMiniPlayerLevel(
    isExpanded.value ? 'compact' : 'expanded',
    settings.miniPlayerRemembersLevel,
  );
}

async function toggleOrientation() {
  await settings.setMiniPlayerOrientation(isVertical.value ? 'horizontal' : 'vertical');
}

async function toggleOnTop() {
  await settings.setMiniPlayerAlwaysOnTop(!settings.miniPlayerAlwaysOnTop);
}

/** Closing the dock may or may not mean closing the app: the answer can be remembered. */
async function requestClose() {
  if (settings.miniPlayerCloseAction === 'ask') {
    const opened = await openMiniCloseConfirmation();

    // Browser previews and tests have no Tauri window to open, so retain the in-webview
    // dialog as a graceful fallback outside the desktop shell.
    if (!opened) {
      isClosing.value = true;
    }

    return;
  }

  await close(settings.miniPlayerCloseAction === 'app');
}

async function close(quitsApp: boolean, remember = remembers.value) {
  if (remember) {
    await settings.setMiniPlayerCloseAction(quitsApp ? 'app' : 'dock');
  }

  const position = await windowPosition();

  if (position !== null) {
    await settings.setMiniPlayerPosition(position);
  }

  isClosing.value = false;

  if (quitsApp) {
    await sendMiniCommand('quit');
    return;
  }

  await closeMiniPlayer();
}
</script>

<template>
  <div
    class="mini_player"
    :class="{
      mini_player_vertical: isVertical,
      mini_player_expanded: isExpanded,
      mini_player_loading: state === null,
      mini_player_accented: state?.gradient !== null && state?.gradient !== undefined,
    }"
    :style="{ ...gradientStyle, ...progressStyle }"
    :aria-busy="state === null"
  >
    <!-- The window commands take the top line, out of the way of the transport. -->
    <div class="mini_player_bar" data-tauri-drag-region>
      <button
        class="mini_player_button"
        type="button"
        :aria-label="isExpanded ? t('mini.collapse') : t('mini.expandDock')"
        :aria-pressed="isExpanded"
        :disabled="state === null"
        data-testid="mini-level"
        @click="toggleLevel"
      >
        <AppIcon :name="isExpanded ? 'collapse' : 'expand'" />
      </button>

      <span class="mini_player_grip" data-tauri-drag-region></span>

      <button
        v-if="!isExpanded"
        class="mini_player_button"
        type="button"
        :aria-label="t('mini.menu.label')"
        :aria-expanded="isSheetOpen"
        :disabled="state === null"
        data-testid="mini-menu"
        @click="isSheetOpen = !isSheetOpen"
      >
        <AppIcon name="more" />
      </button>
      <button
        v-if="!isExpanded"
        class="mini_player_button"
        :class="{ mini_player_button_active: settings.miniPlayerAlwaysOnTop }"
        type="button"
        :aria-label="settings.miniPlayerAlwaysOnTop ? t('mini.unpin') : t('mini.pin')"
        :aria-pressed="settings.miniPlayerAlwaysOnTop"
        :disabled="state === null"
        data-testid="mini-pin"
        @click="toggleOnTop"
      >
        <AppIcon name="pin" />
      </button>
      <button
        v-if="!isExpanded"
        class="mini_player_button"
        type="button"
        :aria-label="t('mini.expand')"
        :disabled="state === null"
        data-testid="mini-expand"
        @click="sendMiniCommand('expand')"
      >
        <AppIcon name="maximize" />
      </button>
      <button
        v-if="!isExpanded"
        class="mini_player_button"
        type="button"
        :aria-label="t('mini.close')"
        :disabled="state === null"
        data-testid="mini-close"
        @click="requestClose"
      >
        <AppIcon name="close" />
      </button>
    </div>

    <!-- What is playing and what to do with it on the same line: the dock is read across,
         and the bar underneath is then the only thing left to look at. -->
    <div class="mini_player_track">
      <span class="mini_player_cover">
        <img v-if="state?.cover" :src="state.cover" alt="" />
        <AppIcon v-else name="note" />
      </span>

      <span class="mini_player_names">
        <span v-if="state !== null" class="mini_player_title">{{ state.title }}</span>
        <span
          v-else
          class="mini_player_title mini_player_skeleton mini_player_skeleton_title"
          aria-hidden="true"
        ></span>
        <span v-if="state !== null" class="mini_player_artist">{{ state.artist ?? '' }}</span>
        <span
          v-else
          class="mini_player_artist mini_player_skeleton mini_player_skeleton_artist"
          aria-hidden="true"
        ></span>
      </span>

      <div class="mini_player_controls">
        <button
          class="mini_player_button"
          type="button"
          :aria-label="t('player.previous')"
          :disabled="!state?.hasPrevious"
          data-testid="mini-previous"
          @click="sendMiniCommand('previous')"
        >
          <AppIcon name="previous" />
        </button>
        <button
          class="mini_player_button mini_player_button_main"
          type="button"
          :aria-label="state?.isPlaying ? t('player.pause') : t('player.play')"
          :disabled="state === null"
          data-testid="mini-toggle"
          @click="sendMiniCommand('toggle')"
        >
          <AppIcon :name="state?.isPlaying ? 'pause' : 'play'" />
        </button>
        <button
          class="mini_player_button"
          type="button"
          :aria-label="t('player.next')"
          :disabled="!state?.hasNext"
          data-testid="mini-next"
          @click="sendMiniCommand('next')"
        >
          <AppIcon name="next" />
        </button>
        <button
          v-if="isExpanded"
          class="mini_player_button"
          type="button"
          :aria-label="t('player.stop')"
          :disabled="state === null"
          data-testid="mini-stop"
          @click="sendMiniCommand('stop')"
        >
          <AppIcon name="stop" />
        </button>

        <!-- In the expanded layout the window commands sit beside the transport, where they
             are used, instead of taking a separate command row above it. -->
        <div v-if="isExpanded" class="mini_player_window_controls">
          <button
            class="mini_player_button"
            type="button"
            :aria-label="t('mini.menu.label')"
            :aria-expanded="isSheetOpen"
            :disabled="state === null"
            data-testid="mini-menu"
            @click="isSheetOpen = !isSheetOpen"
          >
            <AppIcon name="more" />
          </button>
          <button
            class="mini_player_button"
            :class="{ mini_player_button_active: settings.miniPlayerAlwaysOnTop }"
            type="button"
            :aria-label="settings.miniPlayerAlwaysOnTop ? t('mini.unpin') : t('mini.pin')"
            :aria-pressed="settings.miniPlayerAlwaysOnTop"
            :disabled="state === null"
            data-testid="mini-pin"
            @click="toggleOnTop"
          >
            <AppIcon name="pin" />
          </button>
          <button
            class="mini_player_button"
            type="button"
            :aria-label="t('mini.expand')"
            :disabled="state === null"
            data-testid="mini-expand"
            @click="sendMiniCommand('expand')"
          >
            <AppIcon name="maximize" />
          </button>
          <button
            class="mini_player_button"
            type="button"
            :aria-label="t('mini.close')"
            :disabled="state === null"
            data-testid="mini-close"
            @click="requestClose"
          >
            <AppIcon name="close" />
          </button>
        </div>
      </div>
    </div>

    <!-- The line follows the track without taking a row of its own; the bar is seekable. -->
    <PlayerProgress
      v-if="settings.miniPlayerProgress !== 'none'"
      class="mini_player_progress"
      :class="{
        mini_player_progress_line: settings.miniPlayerProgress === 'line',
        mini_player_progress_playing: state?.isPlaying === true,
      }"
      :position="state?.position ?? 0"
      :duration="state?.duration ?? 0"
      :hide-times="settings.miniPlayerProgress === 'line'"
      data-testid="mini-progress"
      @seek="sendMiniCommand('seek', $event)"
    />

    <!-- The second level: the volume, next to the transport rather than under it. -->
    <div class="mini_player_sound">
      <button
        class="mini_player_button"
        type="button"
        :aria-label="state?.isMuted ? t('player.unmute') : t('player.mute')"
        :aria-pressed="state?.isMuted ?? false"
        :disabled="state === null"
        data-testid="mini-mute"
        @click="sendMiniCommand('mute')"
      >
        <AppIcon :name="state?.isMuted ? 'mute' : 'volume'" />
      </button>
      <PlayerVolume
        class="mini_player_volume"
        :model-value="state?.volume ?? 0"
        :disabled="state === null"
        @update:model-value="sendMiniCommand('volume', $event)"
      />
    </div>
  </div>

  <!-- The menu belongs to the window, not to the dock surface: it can float over it and over
       the confirmation dialog without being clipped by the dock layout. -->
  <Teleport to="body">
    <div v-if="isSheetOpen" class="mini_player_sheet" role="menu" data-testid="mini-sheet">
      <button
        class="mini_player_sheet_item"
        type="button"
        role="menuitem"
        :disabled="state === null"
        data-testid="mini-sheet-stop"
        @click="sendMiniCommand('stop')"
      >
        <AppIcon name="stop" />
        <span>{{ t('player.stop') }}</span>
      </button>
      <button
        class="mini_player_sheet_item"
        type="button"
        role="menuitem"
        :disabled="!state?.hasPrevious"
        data-testid="mini-sheet-previous"
        @click="sendMiniCommand('previous')"
      >
        <AppIcon name="previous" />
        <span>{{ t('player.previous') }}</span>
      </button>
      <button
        class="mini_player_sheet_item"
        type="button"
        role="menuitemradio"
        :aria-checked="state?.isMuted ?? false"
        :disabled="state === null"
        data-testid="mini-sheet-mute"
        @click="sendMiniCommand('mute')"
      >
        <AppIcon :name="state?.isMuted ? 'mute' : 'volume'" />
        <span>{{ state?.isMuted ? t('player.unmute') : t('player.mute') }}</span>
      </button>

      <div class="mini_player_sheet_volume">
        <PlayerVolume
          :model-value="state?.volume ?? 0"
          :disabled="state === null"
          @update:model-value="sendMiniCommand('volume', $event)"
        />
      </div>

      <hr class="mini_player_sheet_divider" />

      <button
        class="mini_player_sheet_item"
        type="button"
        role="menuitemradio"
        :aria-checked="isVertical"
        :disabled="state === null"
        data-testid="mini-orientation"
        @click="toggleOrientation"
      >
        <AppIcon :name="isVertical ? 'grid' : 'list'" />
        <span>{{ isVertical ? t('mini.menu.horizontal') : t('mini.menu.vertical') }}</span>
      </button>
    </div>
  </Teleport>

  <!-- Kept outside the dock surface so the dialog has its own layer and never changes the
       dock's layout. AppModal also teleports its dialog to the window body. -->
  <AppModal :open="isClosing" :title="t('mini.confirm.title')" @close="isClosing = false">
    <p>{{ t('mini.confirm.message') }}</p>
    <label class="mini_player_remember">
      <input v-model="remembers" type="checkbox" data-testid="mini-remember" />
      <span>{{ t('mini.confirm.remember') }}</span>
    </label>

    <template #actions>
      <AppButton data-testid="mini-close-dock" @click="close(false)">
        {{ t('mini.confirm.dockOnly') }}
      </AppButton>
      <AppButton variant="danger" data-testid="mini-close-app" @click="close(true)">
        {{ t('mini.confirm.wholeApp') }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.mini_player {
  display: flex;
  position: relative;
  flex-direction: column;
  gap: $space_xs;
  height: 100%;
  padding: $space_2xs $space_sm $space_sm;
  // Two lines rather than one: the dock is an undecorated window standing on whatever
  // happens to be behind it, and a single edge disappears against a surface of its own
  // value. The outer one holds the shape, the inner one keeps it there on a dark desktop.
  border: 1px solid var(--color_border_strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color_text) 10%, transparent);
  background-color: var(--color_bg);
  color: var(--color_text);

  // The colour of the cover, laid over the window background.
  &_accented {
    background-image: var(--dock_gradient);
    background-repeat: no-repeat;
  }

  &_bar {
    display: flex;
    gap: $space_2xs;
    align-items: center;
  }

  // The empty middle of the top line is what the window is dragged by.
  &_grip {
    flex: 1;
    align-self: stretch;
  }

  &_track {
    display: flex;
    flex: 1;
    gap: $space_sm;
    align-items: center;
    min-width: 0;
  }

  &_vertical &_track {
    flex: 0 0 auto;
    flex-direction: column;
    text-align: center;
  }

  &_cover {
    display: inline-flex;
    position: relative;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    overflow: hidden;
    border: 1px solid var(--color_border);
    border-radius: $radius_sm;
    background-color: var(--color_surface_alt);
    color: var(--color_text_muted);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    &::after {
      position: absolute;
      inset: 0.2rem;
      border-radius: $radius_sm;
      background: linear-gradient(
        110deg,
        transparent 20%,
        color-mix(in srgb, var(--color_text) 24%, transparent) 45%,
        transparent 70%
      );
      content: '';
      opacity: 0;
      transform: translateX(-100%);
    }
  }

  &_loading &_cover::after {
    opacity: 1;
    animation: mini_player_loading 1.2s ease-in-out infinite;
  }

  &_vertical &_cover {
    width: 5rem;
    height: 5rem;
  }

  &_names {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &_title {
    @include selectable_text;

    overflow: hidden;
    font-size: 0.875em;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_artist {
    @include selectable_text;

    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.75em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_controls {
    display: flex;
    flex-shrink: 0;
    gap: $space_xs;
    align-items: center;
    justify-content: center;
  }

  &_window_controls {
    display: flex;
    gap: $space_2xs;
    align-items: center;
    padding-left: $space_2xs;
    border-left: 1px solid var(--color_border);
  }

  // The volume is not the length of the track: a short slider, kept at the end of the row
  // next to the command it belongs to.
  &_sound {
    display: flex;
    gap: $space_xs;
    align-items: center;
    justify-content: flex-end;
  }

  &_volume {
    flex: 0 0 auto;
    width: 6rem;
  }

  &_progress {
    flex-shrink: 0;
  }

  // Reduced to a line, the progress is read at a glance and takes no room.
  &_progress_line {
    font-size: 0.75em;
  }

  // The bar is the one thing on its row, so it is drawn to be seen from across a desk: a
  // thicker track, and a round marker large enough to be aimed at.
  &_progress :deep(.app_slider_field) {
    height: 1.1rem;
    appearance: none;
    background: none;

    &::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: 999px;
      background: linear-gradient(
        to right,
        var(--color_accent) var(--mini_progress, 0%),
        color-mix(in srgb, var(--color_text) 20%, transparent) var(--mini_progress, 0%)
      );
    }

    &::-webkit-slider-thumb {
      width: 0.85rem;
      height: 0.85rem;
      margin-top: -0.25rem;
      appearance: none;
      border-radius: 999px;
      background-color: var(--color_accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color_accent) 25%, transparent);
    }
  }

  // While the sound is running the marker breathes, which is what says at a glance that the
  // dock is playing rather than paused at that point.
  &_progress_playing :deep(.app_slider_field::-webkit-slider-thumb) {
    animation: mini_player_pulse 1.6s ease-in-out infinite;
  }

  // Over the face of the dock, under the top line that opened it.
  &_sheet {
    display: flex;
    position: fixed;
    top: 2.35rem;
    right: $space_2xs;
    width: min(16rem, calc(100% - #{$space_sm}));
    max-height: calc(100% - 2.75rem);
    z-index: 50;
    flex-direction: column;
    gap: $space_2xs;
    padding: $space_xs;
    @include surface_panel($radius_md);
    box-shadow: var(--shadow_raised);

    @include scroll_area;

    &_item {
      display: flex;
      flex-shrink: 0;
      gap: $space_sm;
      align-items: center;
      min-height: 1.9rem;
      padding: 0 $space_sm;
      border: 0;
      border-radius: $radius_sm;
      background: none;
      color: var(--color_text);
      font: inherit;
      font-size: 0.8125em;
      text-align: left;
      white-space: nowrap;
      cursor: pointer;

      &:hover:not(:disabled) {
        background-color: var(--color_surface_hover);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &[aria-checked='true'] {
        color: var(--color_accent);
      }

      @include focus_ring;
    }

    &_volume {
      display: flex;
      flex-shrink: 0;
      padding: 0 $space_sm;
    }

    &_divider {
      flex-shrink: 0;
      height: 1px;
      margin: $space_2xs 0;
      border: 0;
      background-color: var(--color_border);
    }
  }

  &_button {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color_text_muted);
    font: inherit;
    font-size: 0.75em;
    cursor: pointer;

    &:disabled {
      opacity: 0.35;
      cursor: wait;
    }

    &:hover:not(:disabled) {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    @include focus_ring;

    &_main {
      width: 2.25rem;
      height: 2.25rem;
      background-color: var(--color_accent);
      color: var(--color_on_accent);

      &:hover:not(:disabled) {
        background-color: var(--color_accent_hover);
        color: var(--color_on_accent);
      }
    }

    &_active {
      background-color: color-mix(in srgb, var(--color_accent) 18%, transparent);
      color: var(--color_accent);

      &:hover:not(:disabled) {
        background-color: color-mix(in srgb, var(--color_accent) 28%, transparent);
        color: var(--color_accent);
      }
    }
  }

  &_skeleton {
    display: block;
    height: 0.7rem;
    border-radius: 999px;
    background: linear-gradient(
      100deg,
      color-mix(in srgb, var(--color_text) 10%, transparent) 20%,
      color-mix(in srgb, var(--color_text) 24%, transparent) 50%,
      color-mix(in srgb, var(--color_text) 10%, transparent) 80%
    );
    background-size: 200% 100%;
    animation: mini_player_skeleton 1.25s ease-in-out infinite;
  }

  &_skeleton_title {
    width: min(12rem, 80%);
  }

  &_skeleton_artist {
    width: min(8rem, 55%);
    margin-top: $space_2xs;
  }

  &_remember {
    display: flex;
    gap: $space_sm;
    align-items: center;
    margin-top: $space_md;
    cursor: pointer;

    input {
      width: 1rem;
      height: 1rem;
      accent-color: var(--color_accent);
    }
  }
}

@keyframes mini_player_pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color_accent) 25%, transparent);
  }

  50% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--color_accent) 12%, transparent);
  }
}

@keyframes mini_player_loading {
  to {
    transform: translateX(100%);
  }
}

@keyframes mini_player_skeleton {
  from {
    background-position: 100% 0;
  }

  to {
    background-position: -100% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mini_player_progress_playing :deep(.app_slider_field::-webkit-slider-thumb) {
    animation: none;
  }

  .mini_player_skeleton {
    animation: none;
  }
}
</style>
