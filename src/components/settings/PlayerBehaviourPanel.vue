<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppSelect from '@/components/common/AppSelect.vue';
import { useSettingsStore } from '@/stores/settings';
import {
  DOCK_CLOSE_ACTIONS,
  DOCK_ORIENTATIONS,
  type DockCloseAction,
  type DockOrientation,
} from '@/types/settings';

const { t } = useI18n();
const settings = useSettingsStore();

/** The shape of the dock only means something once the dock is allowed to appear. */
const isDockDisabled = computed(() => !settings.miniPlayerEnabled);

const orientationOptions = computed(() =>
  DOCK_ORIENTATIONS.map((orientation) => ({
    value: orientation,
    label: t(`settings.playerBehaviour.orientations.${orientation}`),
  })),
);

const closeOptions = computed(() =>
  DOCK_CLOSE_ACTIONS.map((action) => ({
    value: action,
    label: t(`settings.playerBehaviour.closeActions.${action}`),
  })),
);

async function onKeepOpenChange(event: Event) {
  await settings.setKeepPlayerOpen((event.target as HTMLInputElement).checked);
}

async function onDockChange(event: Event) {
  await settings.setMiniPlayerEnabled((event.target as HTMLInputElement).checked);
}

async function onAlwaysOnTopChange(event: Event) {
  await settings.setMiniPlayerAlwaysOnTop((event.target as HTMLInputElement).checked);
}

async function onOrientationChange(value: string) {
  await settings.setMiniPlayerOrientation(value as DockOrientation);
}

async function onCloseActionChange(value: string) {
  await settings.setMiniPlayerCloseAction(value as DockCloseAction);
}
</script>

<template>
  <div class="player_behaviour_panel">
    <label class="player_behaviour_panel_check">
      <input
        type="checkbox"
        :checked="settings.keepPlayerOpen"
        data-testid="keep-player-open-toggle"
        @change="onKeepOpenChange"
      />
      <span>{{ t('settings.playerBehaviour.keepOpen') }}</span>
    </label>

    <label class="player_behaviour_panel_check">
      <input
        type="checkbox"
        :checked="settings.miniPlayerEnabled"
        data-testid="mini-player-toggle"
        @change="onDockChange"
      />
      <span>{{ t('settings.playerBehaviour.dock') }}</span>
    </label>

    <!-- The shape of the dock: what it is set to here is what it opens as. -->
    <template v-if="settings.miniPlayerEnabled">
      <label class="player_behaviour_panel_check player_behaviour_panel_check_nested">
        <input
          type="checkbox"
          :checked="settings.miniPlayerAlwaysOnTop"
          :disabled="isDockDisabled"
          data-testid="mini-player-on-top-toggle"
          @change="onAlwaysOnTopChange"
        />
        <span>{{ t('settings.playerBehaviour.alwaysOnTop') }}</span>
      </label>

      <AppSelect
        class="player_behaviour_panel_select"
        :model-value="settings.miniPlayerOrientation"
        :options="orientationOptions"
        :label="t('settings.playerBehaviour.orientation')"
        data-testid="mini-player-orientation"
        @update:model-value="onOrientationChange"
      />

      <AppSelect
        class="player_behaviour_panel_select"
        :model-value="settings.miniPlayerCloseAction"
        :options="closeOptions"
        :label="t('settings.playerBehaviour.closeAction')"
        data-testid="mini-player-close-action"
        @update:model-value="onCloseActionChange"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.player_behaviour_panel {
  display: flex;
  flex-direction: column;
  gap: $space_sm;
  align-items: flex-start;

  &_check {
    display: flex;
    gap: $space_sm;
    align-items: center;
    color: var(--color_text);
    cursor: pointer;

    input {
      width: 1rem;
      height: 1rem;
      accent-color: var(--color_accent);
    }

    // A line that depends on the one above it reads as its detail.
    &_nested {
      margin-left: $space_lg;
    }
  }

  &_select {
    margin-left: $space_lg;
  }
}
</style>
