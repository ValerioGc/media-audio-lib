<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSettingsStore } from '@/stores/settings';
import { MAX_PLAYER_BLUR } from '@/types/settings';

const { t } = useI18n();
const settings = useSettingsStore();
const blurPercent = computed(() => Math.round((settings.playerBlur / MAX_PLAYER_BLUR) * 100));

function onChange(event: Event) {
  void settings.setCoverGradientEnabled((event.target as HTMLInputElement).checked);
}

function onTransparencyChange(event: Event) {
  void settings.setPlayerTransparency(Number((event.target as HTMLInputElement).value));
}

function onBlurChange(event: Event) {
  const percentage = Number((event.target as HTMLInputElement).value);
  void settings.setPlayerBlur((percentage / 100) * MAX_PLAYER_BLUR);
}

function onIntensityChange(event: Event) {
  void settings.setCoverGradientIntensity(Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="cover_gradient_toggle">
    <label class="cover_gradient_toggle_check">
      <input
        type="checkbox"
        :checked="settings.coverGradientEnabled"
        data-testid="cover-gradient-toggle"
        @change="onChange"
      />
      <span>{{ t('settings.coverGradient.toggle') }}</span>
    </label>

    <label class="cover_gradient_toggle_slider">
      <span>{{ t('settings.coverGradient.transparency') }}</span>
      <input
        type="range"
        min="0"
        max="45"
        step="1"
        :value="settings.playerTransparency"
        data-testid="player-transparency"
        @input="onTransparencyChange"
      />
      <strong>{{ settings.playerTransparency }}%</strong>
    </label>

    <label class="cover_gradient_toggle_slider">
      <span>{{ t('settings.coverGradient.intensity') }}</span>
      <input
        type="range"
        min="40"
        max="200"
        step="1"
        :value="settings.coverGradientIntensity"
        data-testid="cover-gradient-intensity"
        @input="onIntensityChange"
      />
      <strong>{{ settings.coverGradientIntensity }}%</strong>
    </label>

    <label class="cover_gradient_toggle_slider">
      <span>{{ t('settings.coverGradient.blur') }}</span>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        :value="blurPercent"
        data-testid="player-blur"
        @input="onBlurChange"
      />
      <strong>{{ blurPercent }}%</strong>
    </label>
  </div>
</template>

<style scoped lang="scss">
.cover_gradient_toggle {
  display: flex;
  flex-direction: column;
  gap: $space_sm;
  align-items: flex-start;
  color: var(--color_text);

  &_check,
  &_slider {
    display: flex;
    gap: $space_sm;
    align-items: center;
  }

  &_check {
    cursor: pointer;
  }

  &_slider {
    width: min(28rem, 100%);

    span {
      min-width: 8rem;
      color: var(--color_text_muted);
      font-size: 0.875em;
    }

    input {
      flex: 1;
    }

    strong {
      min-width: 3rem;
      font-size: 0.875em;
      font-weight: 600;
      text-align: right;
    }
  }

  input[type='checkbox'] {
    width: 1rem;
    height: 1rem;
    accent-color: var(--color_accent);
  }

  input[type='range'] {
    accent-color: var(--color_accent);
  }
}
</style>
