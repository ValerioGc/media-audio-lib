<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import PlayerControls from '@/components/player/PlayerControls.vue';
import PlayerProgress from '@/components/player/PlayerProgress.vue';
import PlayerSideControls from '@/components/player/PlayerSideControls.vue';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { TrackView } from '@/types/library';

const props = withDefaults(
  defineProps<{
    track: TrackView;
    showLibraryLink?: boolean;
  }>(),
  { showLibraryLink: false },
);

const emit = defineEmits<{
  collapse: [];
  close: [];
  openLibrary: [];
}>();

const { t } = useI18n();
const player = usePlayerStore();
const settings = useSettingsStore();

/** Everything that is not title and artist goes under the cover. */
const details = computed(() => [
  { key: 'album', value: props.track.album },
  { key: 'year', value: props.track.year },
  { key: 'genre', value: props.track.genre },
]);

const accentStyle = computed(() => ({
  '--player_surface_strength': `${100 - settings.playerTransparency}%`,
  '--player_blur': `${settings.playerBlur}px`,
  ...(settings.coverGradientEnabled && player.coverAccent !== null
    ? { '--cover_accent_gradient': player.coverAccent.surfaceGradient }
    : {}),
}));

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (props.showLibraryLink) {
      emit('openLibrary');
    } else {
      emit('collapse');
    }
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
  <section
    class="player_full"
    :class="{
      player_full_glass: settings.playerTransparency > 0 || settings.playerBlur > 0,
      player_full_accented: settings.coverGradientEnabled && player.coverAccent !== null,
    }"
    :style="accentStyle"
    :aria-label="t('player.nowPlaying')"
  >
    <header class="player_full_header">
      <AppButton
        v-if="showLibraryLink"
        variant="ghost"
        data-testid="open-library-from-player"
        @click="emit('openLibrary')"
      >
        <AppIcon name="back" />
        {{ t('player.openLibrary') }}
      </AppButton>
      <AppTooltip v-else :text="t('player.collapse')" align="start">
        <AppButton
          variant="ghost"
          :aria-label="t('player.collapse')"
          data-testid="player-collapse"
          @click="emit('collapse')"
        >
          <AppIcon name="collapse" />
        </AppButton>
      </AppTooltip>

      <span class="player_full_label">{{ t('player.nowPlaying') }}</span>

      <AppTooltip :text="t('player.close')">
        <AppButton variant="ghost" :aria-label="t('player.close')" @click="emit('close')">
          <AppIcon name="close" />
        </AppButton>
      </AppTooltip>
    </header>

    <div class="player_full_body">
      <div class="player_full_stage">
        <div class="player_full_heading">
          <h1 class="player_full_title" :title="track.title">{{ track.title }}</h1>
          <p class="player_full_artist">{{ track.artist ?? t('library.row.unknown') }}</p>
        </div>

        <div class="player_full_cover">
          <CoverImage :track="track" size="card" eager />
        </div>

        <!-- Album, year and genre read as one line under the cover, not as three blocks. -->
        <dl class="player_full_details">
          <div v-for="detail in details" :key="detail.key" class="player_full_detail">
            <dt class="player_full_detail_label">{{ t(`library.columns.${detail.key}`) }}</dt>
            <dd class="player_full_detail_value">
              {{ detail.value ?? t('library.row.unknown') }}
            </dd>
          </div>
        </dl>
      </div>

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
            class="player_full_transport_main"
            prominent
            :is-playing="player.isPlaying"
            :has-next="player.hasNext"
            :is-shuffle-enabled="player.isShuffleEnabled"
            :is-repeat-one-enabled="player.isRepeatOneEnabled"
            :disabled="player.isLoading"
            @previous="player.previous()"
            @toggle="player.toggle()"
            @next="player.next()"
            @toggle-shuffle="player.toggleShuffle()"
            @toggle-repeat-one="player.toggleRepeatOne()"
          />
          <PlayerSideControls
            class="player_full_transport_side"
            :volume="player.volume"
            :disabled="player.isLoading"
            @stop="player.stop()"
            @update:volume="player.setVolume($event)"
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

  &_glass {
    background-color: color-mix(
      in srgb,
      var(--color_bg) var(--player_surface_strength),
      transparent
    );
    backdrop-filter: blur(var(--player_blur));
  }

  &_accented {
    background:
      var(--cover_accent_gradient),
      color-mix(in srgb, var(--color_bg) var(--player_surface_strength), transparent);
  }

  &_header {
    display: flex;
    gap: $space_md;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: $space_sm $page_gutter;
  }

  &_label {
    color: var(--color_text_muted);
    font-size: 0.875em;
    letter-spacing: 0.02em;
  }

  &_body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $space_lg;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: $space_md $page_gutter $space_xl;
    text-align: center;

    @include scroll_area(stable both-edges);
  }

  // Title, cover and details form one block, so they stay together while the transport
  // keeps its own space at the bottom.
  &_stage {
    display: flex;
    flex-direction: column;
    gap: $space_md;
    align-items: center;
    max-width: 100%;
  }

  &_heading {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    max-width: min(34rem, 100%);
  }

  &_title {
    overflow: hidden;
    font-size: 1.6em;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_artist {
    color: var(--color_accent);
    font-size: 1.0625em;
    font-weight: 600;
  }

  &_cover {
    width: min(19rem, 46vh);
    border-radius: $radius_lg;
    box-shadow: var(--shadow_raised);
    overflow: hidden;
  }

  &_details {
    display: flex;
    gap: $space_xs $space_md;
    flex-wrap: wrap;
    justify-content: center;
    max-width: min(34rem, 100%);
    padding: $space_sm $space_md;
    @include surface_panel(999px, color-mix(in srgb, var(--color_surface) 70%, transparent));
  }

  &_detail {
    display: flex;
    gap: $space_xs;
    align-items: baseline;
    min-width: 0;

    // A thin separator between the values, but not before the first one.
    & + & {
      padding-left: $space_md;
      border-left: 1px solid var(--color_border);
    }

    &_label {
      color: var(--color_text_muted);
      font-size: 0.7em;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    &_value {
      overflow: hidden;
      margin: 0;
      font-size: 0.9375em;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &_error {
    color: #c42b1c;
  }

  &_playback {
    display: flex;
    flex-direction: column;
    gap: $space_md;
    width: min(36rem, 100%);
  }

  // The transport is centred on the page and the secondary controls sit at its right,
  // without pushing play off the middle.
  &_transport {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: $space_sm;
    align-items: center;

    &_main {
      grid-column: 2;
      justify-content: center;
    }

    &_side {
      grid-column: 3;
      justify-content: flex-end;
    }
  }
}

@media (max-width: 640px) {
  .player_full {
    &_transport {
      grid-template-columns: 1fr;
      justify-items: center;

      &_main {
        grid-column: 1;
      }

      &_side {
        grid-column: 1;
      }
    }

    &_detail + &_detail {
      padding-left: 0;
      border-left: 0;
    }
  }
}
</style>
