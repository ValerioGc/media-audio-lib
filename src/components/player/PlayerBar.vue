<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import PlayerControls from '@/components/player/PlayerControls.vue';
import PlayerProgress from '@/components/player/PlayerProgress.vue';
import PlayerVolume from '@/components/player/PlayerVolume.vue';
import { usePlayerStore } from '@/stores/player';
import type { TrackView } from '@/types/library';

defineProps<{ track: TrackView }>();

const emit = defineEmits<{
  expand: [];
  close: [];
}>();

const { t } = useI18n();
const player = usePlayerStore();
</script>

<template>
  <section class="player_bar" :aria-label="t('player.nowPlaying')">
    <p v-if="player.errorKey !== null" class="player_bar_error" role="alert">
      {{ t(`player.errors.${player.errorKey}`) }}
    </p>

    <div class="player_bar_body">
      <div class="player_bar_track">
        <CoverImage :track="track" size="thumb" eager />

        <div class="player_bar_info">
          <p class="player_bar_title" :title="track.title">{{ track.title }}</p>
          <p class="player_bar_artist">{{ track.artist ?? t('library.row.unknown') }}</p>
        </div>
      </div>

      <div class="player_bar_playback">
        <PlayerControls
          :is-playing="player.isPlaying"
          :has-next="player.hasNext"
          :disabled="player.isLoading"
          @previous="player.previous()"
          @toggle="player.toggle()"
          @stop="player.stop()"
          @next="player.next()"
        />
        <PlayerProgress
          :position="player.position"
          :duration="player.duration"
          @seek="player.seek($event)"
        />
      </div>

      <div class="player_bar_actions">
        <PlayerVolume :model-value="player.volume" @update:model-value="player.setVolume($event)" />
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
    </div>
  </section>
</template>

<style scoped lang="scss">
.player_bar {
  display: flex;
  flex-direction: column;
  padding: $space_sm $space_lg;
  border-top: 1px solid var(--color_border);
  background-color: var(--color_surface);
  box-shadow: var(--shadow_raised);

  &_error {
    padding-bottom: $space_xs;
    color: #c42b1c;
    font-size: 0.875em;
  }

  &_body {
    display: flex;
    gap: $space_md;
    align-items: center;
  }

  &_track {
    display: flex;
    flex: 1 1 14rem;
    gap: $space_md;
    align-items: center;
    min-width: 0;
  }

  &_playback {
    display: flex;
    flex: 2 1 24rem;
    gap: $space_md;
    align-items: center;
    min-width: 0;
  }

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
