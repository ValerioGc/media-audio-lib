<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppSlider from '@/components/common/AppSlider.vue';

const props = defineProps<{ modelValue: number }>();

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const { t } = useI18n();

const percentage = computed(() => Math.round(props.modelValue * 100));
</script>

<template>
  <div class="player_volume">
    <AppSlider
      :model-value="percentage"
      :label="t('player.volume')"
      :max="100"
      :value-text="t('player.volumeValue', { value: percentage })"
      hide-label
      @update:model-value="emit('update:modelValue', $event / 100)"
    />
  </div>
</template>

<style scoped lang="scss">
.player_volume {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  width: 6rem;
}
</style>
