<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/AppModal.vue';
import PlayerProgress from '@/components/player/PlayerProgress.vue';
import PlayerVolume from '@/components/player/PlayerVolume.vue';
import {
  onPlayerState,
  sendMiniCommand,
  type MiniPlayerState,
} from '@/services/mini-player-bridge';
import { closeMiniPlayer } from '@/services/shell-integration';
import { onWindowMoved, windowPosition } from '@/services/window-controls';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();

const state = ref<MiniPlayerState | null>(null);
const isClosing = ref(false);
const remembers = ref(false);
let unlistenState: (() => void) | null = null;
let unlistenMoved: (() => void) | null = null;

const isVertical = computed(() => settings.miniPlayerOrientation === 'vertical');
const isExpanded = computed(() => settings.miniPlayerLevel === 'expanded');

/** The colour of the cover, painted behind the dock when the setting asks for it. */
const gradientStyle = computed(() =>
  state.value?.gradient === null || state.value === null
    ? {}
    : { '--dock_gradient': state.value.gradient },
);

onMounted(async () => {
  // The dock reads the same settings file as the app, so theme, accent and text size follow.
  await settings.initialize();
  unlistenState = await onPlayerState((received) => {
    state.value = received;
  });

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
  unlistenState = null;
  unlistenMoved = null;
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

async function toggleGradient() {
  await settings.setMiniPlayerGradient(!settings.miniPlayerGradient);
}

/** Closing the dock may or may not mean closing the app: the answer can be remembered. */
async function requestClose() {
  if (settings.miniPlayerCloseAction === 'ask') {
    isClosing.value = true;
    return;
  }

  await close(settings.miniPlayerCloseAction === 'app');
}

async function close(quitsApp: boolean) {
  if (remembers.value) {
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
      mini_player_accented: state?.gradient !== null && state?.gradient !== undefined,
    }"
    :style="gradientStyle"
  >
    <!-- The window commands take the top line, out of the way of the transport. -->
    <div class="mini_player_bar" data-tauri-drag-region>
      <button
        class="mini_player_button"
        type="button"
        :aria-label="isExpanded ? t('mini.collapse') : t('mini.expandDock')"
        :aria-pressed="isExpanded"
        data-testid="mini-level"
        @click="toggleLevel"
      >
        <AppIcon :name="isExpanded ? 'collapse' : 'expand'" />
      </button>

      <span class="mini_player_grip" data-tauri-drag-region></span>

      <button
        class="mini_player_button"
        type="button"
        :aria-label="t('mini.expand')"
        data-testid="mini-expand"
        @click="sendMiniCommand('expand')"
      >
        <AppIcon name="maximize" />
      </button>
      <button
        class="mini_player_button"
        type="button"
        :aria-label="t('mini.close')"
        data-testid="mini-close"
        @click="requestClose"
      >
        <AppIcon name="close" />
      </button>
    </div>

    <div class="mini_player_track">
      <span class="mini_player_cover">
        <img v-if="state?.cover" :src="state.cover" alt="" />
        <AppIcon v-else name="note" />
      </span>

      <span class="mini_player_names">
        <span class="mini_player_title">{{ state?.title ?? t('mini.idle') }}</span>
        <span class="mini_player_artist">{{ state?.artist ?? '' }}</span>
      </span>
    </div>

    <div class="mini_player_controls">
      <button
        v-if="isExpanded"
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
        data-testid="mini-stop"
        @click="sendMiniCommand('stop')"
      >
        <AppIcon name="stop" />
      </button>
    </div>

    <!-- The line follows the track without taking a row of its own; the bar is seekable. -->
    <PlayerProgress
      v-if="settings.miniPlayerProgress !== 'none'"
      class="mini_player_progress"
      :class="{ mini_player_progress_line: settings.miniPlayerProgress === 'line' }"
      :position="state?.position ?? 0"
      :duration="state?.duration ?? 0"
      :hide-times="settings.miniPlayerProgress === 'line'"
      data-testid="mini-progress"
      @seek="sendMiniCommand('seek', $event)"
    />

    <!-- The second level: what does not fit in a glance, and the settings of the dock. -->
    <template v-if="isExpanded">
      <div class="mini_player_sound">
        <button
          class="mini_player_button"
          type="button"
          :aria-label="state?.isMuted ? t('player.unmute') : t('player.mute')"
          :aria-pressed="state?.isMuted ?? false"
          data-testid="mini-mute"
          @click="sendMiniCommand('mute')"
        >
          <AppIcon :name="state?.isMuted ? 'mute' : 'volume'" />
        </button>
        <PlayerVolume
          class="mini_player_volume"
          :model-value="state?.volume ?? 0"
          @update:model-value="sendMiniCommand('volume', $event)"
        />
      </div>

      <div class="mini_player_options">
        <button
          class="mini_player_option"
          :class="{ mini_player_option_on: isVertical }"
          type="button"
          :aria-pressed="isVertical"
          data-testid="mini-orientation"
          @click="toggleOrientation"
        >
          <AppIcon :name="isVertical ? 'grid' : 'list'" />
          <span>{{ isVertical ? t('mini.menu.horizontal') : t('mini.menu.vertical') }}</span>
        </button>
        <button
          class="mini_player_option"
          :class="{ mini_player_option_on: settings.miniPlayerAlwaysOnTop }"
          type="button"
          :aria-pressed="settings.miniPlayerAlwaysOnTop"
          data-testid="mini-on-top"
          @click="toggleOnTop"
        >
          <AppIcon name="expand" />
          <span>{{ t('mini.menu.alwaysOnTop') }}</span>
        </button>
        <button
          class="mini_player_option"
          :class="{ mini_player_option_on: settings.miniPlayerGradient }"
          type="button"
          :aria-pressed="settings.miniPlayerGradient"
          data-testid="mini-gradient"
          @click="toggleGradient"
        >
          <AppIcon name="grid" />
          <span>{{ t('mini.menu.gradient') }}</span>
        </button>
      </div>
    </template>

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
  </div>
</template>

<style scoped lang="scss">
.mini_player {
  display: flex;
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
  }

  &_vertical &_cover {
    width: 5rem;
    height: 5rem;
  }

  &_names {
    display: flex;
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

  &_controls,
  &_sound {
    display: flex;
    gap: $space_xs;
    align-items: center;
    justify-content: center;
  }

  &_volume {
    flex: 1;
  }

  &_progress {
    flex-shrink: 0;
  }

  // Reduced to a line, the progress is read at a glance and takes no room.
  &_progress_line {
    font-size: 0.75em;
  }

  &_options {
    display: flex;
    flex-wrap: wrap;
    gap: $space_2xs;
    justify-content: center;
  }

  &_option {
    display: inline-flex;
    gap: $space_2xs;
    align-items: center;
    padding: $space_2xs $space_xs;
    border: 1px solid var(--color_border);
    border-radius: 999px;
    background: none;
    color: var(--color_text_muted);
    font: inherit;
    font-size: 0.7em;
    cursor: pointer;

    &:hover {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    @include focus_ring;

    &_on {
      border-color: var(--color_accent);
      background-color: var(--color_accent_soft);
      color: var(--color_accent);
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
</style>
