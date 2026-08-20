<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ambience } from '@/services/ambience';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();

/** The preview shows the two colours the background is built from, accent first. */
const previewStyle = computed(() => ({
  backgroundImage: ambience(settings.accentColor, settings.resolvedTheme).layers,
}));

function onBackgroundChange(event: Event) {
  void settings.setAmbientBackgroundEnabled((event.target as HTMLInputElement).checked);
}

function onGlassChange(event: Event) {
  void settings.setGlassSurfacesEnabled((event.target as HTMLInputElement).checked);
}
</script>

<template>
  <div class="ambience_toggle">
    <label class="ambience_toggle_check">
      <input
        type="checkbox"
        :checked="settings.ambientBackgroundEnabled"
        data-testid="ambient-background-toggle"
        @change="onBackgroundChange"
      />
      <span>{{ t('settings.ambience.background') }}</span>
    </label>

    <label class="ambience_toggle_check">
      <input
        type="checkbox"
        :checked="settings.glassSurfacesEnabled"
        data-testid="glass-surfaces-toggle"
        @change="onGlassChange"
      />
      <span>{{ t('settings.ambience.glass') }}</span>
    </label>

    <div
      v-if="settings.ambientBackgroundEnabled"
      class="ambience_toggle_preview"
      :style="previewStyle"
      data-testid="ambience-preview"
    >
      <span class="ambience_toggle_preview_card">{{ t('settings.ambience.preview') }}</span>
    </div>

    <p class="ambience_toggle_hint">{{ t('settings.ambience.hint') }}</p>
  </div>
</template>

<style scoped lang="scss">
.ambience_toggle {
  display: flex;
  flex-direction: column;
  gap: $space_sm;

  &_check {
    display: flex;
    gap: $space_sm;
    align-items: center;
    cursor: pointer;

    input {
      accent-color: var(--color_accent);
    }
  }

  &_preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 5.5rem;
    margin-top: $space_xs;
    border: 1px solid var(--color_border);
    border-radius: $radius_md;
    background-color: var(--color_bg);
    background-repeat: no-repeat;
    background-size: cover;

    &_card {
      padding: $space_sm $space_md;
      font-size: 0.8125em;

      @include glass_surface($radius_md);
    }
  }

  &_hint {
    color: var(--color_text_muted);
    font-size: 0.875em;
  }
}
</style>
