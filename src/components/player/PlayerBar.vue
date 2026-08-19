<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import type { TrackView } from '@/types/library';

defineProps<{ track: TrackView }>();

const emit = defineEmits<{
  expand: [];
  close: [];
}>();

const { t } = useI18n();
</script>

<template>
  <section class="player_bar" :aria-label="t('player.nowPlaying')">
    <CoverImage :track="track" size="thumb" eager />

    <div class="player_bar_info">
      <p class="player_bar_title" :title="track.title">{{ track.title }}</p>
      <p class="player_bar_artist">{{ track.artist ?? t('library.row.unknown') }}</p>
    </div>

    <!-- Playback controls arrive with phase 8, together with the audio element. -->
    <div class="player_bar_actions">
      <AppTooltip :text="t('player.expand')">
        <AppButton
          variant="ghost"
          :aria-label="t('player.expand')"
          data-testid="player-expand"
          @click="emit('expand')"
        >
          <AppIcon name="expand" />
        </AppButton>
      </AppTooltip>
      <AppTooltip :text="t('player.close')">
        <AppButton
          variant="ghost"
          :aria-label="t('player.close')"
          data-testid="player-close"
          @click="emit('close')"
        >
          <AppIcon name="close" />
        </AppButton>
      </AppTooltip>
    </div>
  </section>
</template>

<style scoped lang="scss">
.player_bar {
  display: flex;
  gap: $space_md;
  align-items: center;
  padding: $space_sm $space_lg;
  border-top: 1px solid var(--color_border);
  background-color: var(--color_surface);
  box-shadow: var(--shadow_raised);

  &_info {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &_title {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_artist {
    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.875em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_actions {
    display: flex;
    gap: $space_xs;
    align-items: center;
  }
}
</style>
