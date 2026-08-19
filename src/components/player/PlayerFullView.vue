<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import type { TrackView } from '@/types/library';

defineProps<{ track: TrackView }>();

const emit = defineEmits<{
  collapse: [];
  close: [];
}>();

const { t } = useI18n();

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('collapse');
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
  <section class="player_full" :aria-label="t('player.nowPlaying')">
    <header class="player_full_header">
      <AppButton
        variant="ghost"
        :aria-label="t('player.collapse')"
        data-testid="player-collapse"
        @click="emit('collapse')"
      >
        <AppIcon name="collapse" />
      </AppButton>
      <span class="player_full_label">{{ t('player.nowPlaying') }}</span>
      <AppButton variant="ghost" :aria-label="t('player.close')" @click="emit('close')">
        <AppIcon name="close" />
      </AppButton>
    </header>

    <div class="player_full_body">
      <div class="player_full_cover">
        <CoverImage :track="track" size="card" eager />
      </div>

      <div class="player_full_info">
        <h1 class="player_full_title">{{ track.title }}</h1>
        <p class="player_full_meta">{{ track.artist ?? t('library.row.unknown') }}</p>
        <p class="player_full_meta">{{ track.album ?? t('library.row.unknown') }}</p>
      </div>
    </div>
    <!-- Transport controls, progress bar and volume arrive with phase 8. -->
  </section>
</template>

<style scoped lang="scss">
.player_full {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background-color: var(--color_bg);

  &_header {
    display: flex;
    gap: $space_md;
    align-items: center;
    justify-content: space-between;
    padding: $space_sm $space_lg;
    border-bottom: 1px solid var(--color_border);
    background-color: var(--color_surface);
  }

  &_label {
    color: var(--color_text_muted);
    font-size: 0.875em;
  }

  &_body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $space_lg;
    align-items: center;
    justify-content: center;
    padding: $space_xl;
    text-align: center;
  }

  &_cover {
    width: min(20rem, 60vw);
  }

  &_info {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    max-width: 100%;
  }

  &_title {
    font-size: 1.75em;
    font-weight: 600;
  }

  &_meta {
    color: var(--color_text_muted);
  }
}
</style>
