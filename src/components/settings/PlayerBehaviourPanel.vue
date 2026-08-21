<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();

async function onChange(event: Event) {
  await settings.setKeepPlayerOpen((event.target as HTMLInputElement).checked);
}
</script>

<template>
  <label class="player_behaviour_panel">
    <input
      type="checkbox"
      :checked="settings.keepPlayerOpen"
      data-testid="keep-player-open-toggle"
      @change="onChange"
    />
    <span>{{ t('settings.playerBehaviour.keepOpen') }}</span>
  </label>
</template>

<style scoped lang="scss">
.player_behaviour_panel {
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
}
</style>
