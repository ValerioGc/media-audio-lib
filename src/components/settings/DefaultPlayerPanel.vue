<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import { openDefaultAudioPlayerSettings } from '@/services/default-player';

const { t } = useI18n();
const isOpening = ref(false);
const failed = ref(false);

async function openSettings() {
  isOpening.value = true;
  failed.value = false;

  const opened = await openDefaultAudioPlayerSettings();
  failed.value = !opened;
  isOpening.value = false;
}
</script>

<template>
  <div class="default_player_panel">
    <p class="default_player_panel_text">
      {{ t('settings.defaultPlayer.message') }}
    </p>
    <AppButton variant="primary" :disabled="isOpening" @click="openSettings">
      {{ isOpening ? t('settings.defaultPlayer.opening') : t('settings.defaultPlayer.open') }}
    </AppButton>
    <p v-if="failed" class="default_player_panel_error" role="alert">
      {{ t('settings.defaultPlayer.error') }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.default_player_panel {
  display: flex;
  flex-wrap: wrap;
  gap: $space_md;
  align-items: center;

  &_text {
    flex: 1;
    min-width: 14rem;
    color: var(--color_text_muted);
  }

  &_error {
    flex: 1 0 100%;
    color: var(--color_text);
  }
}
</style>
