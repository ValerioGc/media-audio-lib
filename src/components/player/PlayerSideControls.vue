<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import PlayerVolume from '@/components/player/PlayerVolume.vue';

const props = withDefaults(
  defineProps<{
    volume: number;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  stop: [];
  'update:volume': [value: number];
}>();

const { t } = useI18n();
</script>

<template>
  <!-- Stop ends the playback instead of suspending it, and the volume is not part of the
       transport either: both stay out of the group built around play. -->
  <div class="player_side_controls">
    <AppTooltip :text="t('player.stop')" align="center">
      <AppButton
        variant="ghost"
        class="player_side_controls_stop"
        :aria-label="t('player.stop')"
        :disabled="props.disabled"
        data-testid="player-stop"
        @click="emit('stop')"
      >
        <AppIcon name="stop" />
      </AppButton>
    </AppTooltip>

    <PlayerVolume :model-value="props.volume" @update:model-value="emit('update:volume', $event)" />
  </div>
</template>

<style scoped lang="scss">
.player_side_controls {
  display: flex;
  flex: 0 0 auto;
  gap: $space_sm;
  align-items: center;

  &_stop {
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border-radius: 999px;
    color: var(--color_text_muted);
  }
}
</style>
