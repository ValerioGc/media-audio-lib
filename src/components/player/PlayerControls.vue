<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';

const props = withDefaults(
  defineProps<{
    isPlaying: boolean;
    hasNext: boolean;
    isShuffleEnabled: boolean;
    isRepeatOneEnabled: boolean;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  previous: [];
  toggle: [];
  stop: [];
  next: [];
  toggleShuffle: [];
  toggleRepeatOne: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="player_controls">
    <AppTooltip :text="t('player.shuffle')">
      <AppButton
        variant="ghost"
        class="player_controls_mode"
        :class="{ player_controls_mode_active: props.isShuffleEnabled }"
        :aria-label="t('player.shuffle')"
        :aria-pressed="props.isShuffleEnabled"
        :disabled="props.disabled"
        data-testid="player-shuffle"
        @click="emit('toggleShuffle')"
      >
        <AppIcon name="shuffle" />
      </AppButton>
    </AppTooltip>

    <!-- Previous stays enabled on the first track: it restarts what is playing. -->
    <AppTooltip :text="t('player.previous')">
      <AppButton
        variant="ghost"
        :aria-label="t('player.previous')"
        :disabled="props.disabled"
        data-testid="player-previous"
        @click="emit('previous')"
      >
        <AppIcon name="previous" />
      </AppButton>
    </AppTooltip>

    <AppTooltip :text="props.isPlaying ? t('player.pause') : t('player.play')">
      <AppButton
        variant="primary"
        :aria-label="props.isPlaying ? t('player.pause') : t('player.play')"
        :aria-pressed="props.isPlaying"
        :disabled="props.disabled"
        data-testid="player-toggle"
        @click="emit('toggle')"
      >
        <AppIcon :name="props.isPlaying ? 'pause' : 'play'" />
      </AppButton>
    </AppTooltip>

    <AppTooltip :text="t('player.stop')">
      <AppButton
        variant="ghost"
        :aria-label="t('player.stop')"
        :disabled="props.disabled"
        data-testid="player-stop"
        @click="emit('stop')"
      >
        <AppIcon name="stop" />
      </AppButton>
    </AppTooltip>

    <AppTooltip :text="t('player.next')">
      <AppButton
        variant="ghost"
        :aria-label="t('player.next')"
        :disabled="props.disabled || !props.hasNext"
        data-testid="player-next"
        @click="emit('next')"
      >
        <AppIcon name="next" />
      </AppButton>
    </AppTooltip>

    <AppTooltip :text="t('player.repeatOne')">
      <AppButton
        variant="ghost"
        class="player_controls_mode"
        :class="{ player_controls_mode_active: props.isRepeatOneEnabled }"
        :aria-label="t('player.repeatOne')"
        :aria-pressed="props.isRepeatOneEnabled"
        :disabled="props.disabled"
        data-testid="player-repeat-one"
        @click="emit('toggleRepeatOne')"
      >
        <AppIcon name="repeatOne" />
      </AppButton>
    </AppTooltip>
  </div>
</template>

<style scoped lang="scss">
.player_controls {
  display: flex;
  gap: $space_xs;
  align-items: center;

  &_mode_active {
    border-color: var(--color_accent);
    background-color: var(--color_accent_soft);
    color: var(--color_accent);
  }
}
</style>
