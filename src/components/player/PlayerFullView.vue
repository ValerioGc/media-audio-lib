<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import PlayerControls from '@/components/player/PlayerControls.vue';
import PlayerProgress from '@/components/player/PlayerProgress.vue';
import PlayerVolume from '@/components/player/PlayerVolume.vue';
import { usePlayerStore } from '@/stores/player';
import type { TrackView } from '@/types/library';

const props = defineProps<{ track: TrackView }>();

const emit = defineEmits<{
  collapse: [];
  close: [];
}>();

const { t } = useI18n();
const player = usePlayerStore();

/** Everything that is not title and artist goes under the cover. */
const details = computed(() => [
  { key: 'album', value: props.track.album },
  { key: 'year', value: props.track.year },
  { key: 'genre', value: props.track.genre },
]);

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
      <div class="player_full_heading">
        <h1 class="player_full_title">{{ track.title }}</h1>
        <p class="player_full_artist">{{ track.artist ?? t('library.row.unknown') }}</p>
      </div>

      <div class="player_full_cover">
        <CoverImage :track="track" size="card" eager />
      </div>

      <dl class="player_full_details">
        <div v-for="detail in details" :key="detail.key" class="player_full_detail">
          <dt class="player_full_detail_label">{{ t(`library.columns.${detail.key}`) }}</dt>
          <dd class="player_full_detail_value">{{ detail.value ?? t('library.row.unknown') }}</dd>
        </div>
      </dl>

      <p v-if="player.errorKey !== null" class="player_full_error" role="alert">
        {{ t(`player.errors.${player.errorKey}`) }}
      </p>

      <div class="player_full_playback">
        <PlayerProgress
          :position="player.position"
          :duration="player.duration"
          @seek="player.seek($event)"
        />

        <div class="player_full_transport">
          <PlayerControls
            :is-playing="player.isPlaying"
            :has-next="player.hasNext"
            :is-shuffle-enabled="player.isShuffleEnabled"
            :is-repeat-one-enabled="player.isRepeatOneEnabled"
            :disabled="player.isLoading"
            @previous="player.previous()"
            @toggle="player.toggle()"
            @stop="player.stop()"
            @next="player.next()"
            @toggle-shuffle="player.toggleShuffle()"
            @toggle-repeat-one="player.toggleRepeatOne()"
          />
          <PlayerVolume
            :model-value="player.volume"
            @update:model-value="player.setVolume($event)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.player_full {
  /* The titlebar stays reachable: window controls, settings and guide are on it. */
  position: fixed;
  top: $titlebar_height;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background-color: var(--color_bg);

  &_header {
    display: flex;
    gap: $space_md;
    align-items: center;
    justify-content: space-between;
    padding: $space_sm $page_gutter;
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
    padding: $page_gutter;
    text-align: center;

    @include scroll_area(stable both-edges);
  }

  &_heading {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    max-width: 100%;
  }

  &_title {
    font-size: 1.75em;
    font-weight: 600;
  }

  &_artist {
    color: var(--color_text_muted);
    font-size: 1.125em;
  }

  &_cover {
    width: min(20rem, 60vw);
  }

  &_details {
    display: flex;
    gap: $space_lg;
    flex-wrap: wrap;
    justify-content: center;
  }

  &_detail {
    display: flex;
    flex-direction: column;
    gap: $space_xs;

    &_label {
      color: var(--color_text_muted);
      font-size: 0.75em;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    &_value {
      margin: 0;
    }
  }

  &_error {
    color: #c42b1c;
  }

  &_playback {
    display: flex;
    flex-direction: column;
    gap: $space_md;
    width: min(32rem, 100%);
  }

  &_transport {
    display: flex;
    gap: $space_lg;
    align-items: center;
    justify-content: center;
  }
}
</style>
