<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppMenu from '@/components/common/AppMenu.vue';
import AppModal from '@/components/common/AppModal.vue';
import {
  onPlayerState,
  sendMiniCommand,
  type MiniPlayerState,
} from '@/services/mini-player-bridge';
import { closeMiniPlayer } from '@/services/shell-integration';
import { useSettingsStore } from '@/stores/settings';
import type { MenuItem } from '@/types/menu';

const { t } = useI18n();
const settings = useSettingsStore();

const state = ref<MiniPlayerState | null>(null);
const isClosing = ref(false);
const remembers = ref(false);
let unlisten: (() => void) | null = null;

const isVertical = computed(() => settings.miniPlayerOrientation === 'vertical');

/** The dock is a remote: what it offers is what the main window can be asked for. */
const menuItems = computed<MenuItem[]>(() => [
  {
    id: 'orientation',
    label: isVertical.value ? t('mini.menu.horizontal') : t('mini.menu.vertical'),
    icon: isVertical.value ? 'list' : 'grid',
  },
  {
    id: 'onTop',
    label: t('mini.menu.alwaysOnTop'),
    icon: settings.miniPlayerAlwaysOnTop ? 'check' : 'expand',
  },
]);

onMounted(async () => {
  // The dock reads the same settings file as the app, so theme, accent and text size follow.
  await settings.initialize();
  unlisten = await onPlayerState((received) => {
    state.value = received;
  });
});

onBeforeUnmount(() => {
  unlisten?.();
  unlisten = null;
  settings.dispose();
});

async function runMenu(id: string) {
  if (id === 'orientation') {
    await settings.setMiniPlayerOrientation(isVertical.value ? 'horizontal' : 'vertical');
    return;
  }

  await settings.setMiniPlayerAlwaysOnTop(!settings.miniPlayerAlwaysOnTop);
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

  isClosing.value = false;

  if (quitsApp) {
    await sendMiniCommand('quit');
    return;
  }

  await closeMiniPlayer();
}
</script>

<template>
  <div class="mini_player" :class="{ mini_player_vertical: isVertical }">
    <!-- The whole dock drags the window, except the controls sitting on it. -->
    <div class="mini_player_grip" data-tauri-drag-region></div>

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
        class="mini_player_button"
        type="button"
        :aria-label="t('player.stop')"
        data-testid="mini-stop"
        @click="sendMiniCommand('stop')"
      >
        <AppIcon name="stop" />
      </button>
    </div>

    <div class="mini_player_actions">
      <AppMenu
        :items="menuItems"
        :label="t('mini.menu.label')"
        :hint="t('mini.menu.label')"
        @select="runMenu"
      />
      <button
        class="mini_player_button"
        type="button"
        :aria-label="t('mini.expand')"
        data-testid="mini-expand"
        @click="sendMiniCommand('expand')"
      >
        <AppIcon name="expand" />
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
  position: relative;
  gap: $space_sm;
  align-items: center;
  height: 100%;
  padding: $space_sm $space_md;
  background-color: var(--color_bg);
  color: var(--color_text);

  // Vertical: the same parts, stacked, for a dock kept against a side of the screen.
  &_vertical {
    flex-direction: column;
    justify-content: center;
    text-align: center;
  }

  &_grip {
    position: absolute;
    inset: 0;
  }

  &_track,
  &_controls,
  &_actions {
    display: flex;
    position: relative;
    gap: $space_xs;
    align-items: center;
    min-width: 0;
  }

  &_track {
    flex: 1;
    gap: $space_sm;
  }

  &_vertical &_track {
    flex: 0 0 auto;
    flex-direction: column;
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

  &_button {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.85rem;
    height: 1.85rem;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color_text_muted);
    font: inherit;
    font-size: 0.8em;
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
