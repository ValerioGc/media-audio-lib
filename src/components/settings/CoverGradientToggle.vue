<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();

function onChange(event: Event) {
  void settings.setCoverGradientEnabled((event.target as HTMLInputElement).checked);
}
</script>

<template>
  <label class="cover_gradient_toggle">
    <input
      type="checkbox"
      :checked="settings.coverGradientEnabled"
      data-testid="cover-gradient-toggle"
      @change="onChange"
    />
    <span>{{ t('settings.coverGradient.toggle') }}</span>
  </label>
</template>

<style scoped lang="scss">
.cover_gradient_toggle {
  display: flex;
  gap: $space_sm;
  align-items: center;
  width: fit-content;
  color: var(--color_text);
  cursor: pointer;

  input {
    width: 1rem;
    height: 1rem;
    accent-color: var(--color_accent);
  }
}
</style>
