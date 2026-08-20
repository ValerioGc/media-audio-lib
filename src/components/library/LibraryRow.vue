<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import LibraryCoverCell from '@/components/library/LibraryCoverCell.vue';
import LibraryRowActions from '@/components/library/LibraryRowActions.vue';
import { formatDuration } from '@/services/track-sorting';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { TrackView } from '@/types/library';

const props = defineProps<{
  track: TrackView;
  selected: boolean;
  playing: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  play: [track: TrackView];
  edit: [track: TrackView];
  remove: [track: TrackView];
  verify: [track: TrackView];
}>();

const { t } = useI18n();
const player = usePlayerStore();
const settings = useSettingsStore();

const accentStyle = computed(() =>
  props.playing && settings.coverGradientEnabled && player.coverAccent !== null
    ? { '--cover_row_gradient': player.coverAccent.rowGradient }
    : {},
);
</script>

<template>
  <div
    class="library_row"
    :class="{
      library_row_selected: selected,
      library_row_missing: track.missing,
      library_row_playing: playing,
    }"
    :style="accentStyle"
    role="row"
    tabindex="0"
    :aria-selected="selected"
    :aria-current="playing ? 'true' : undefined"
    @click="emit('select', track.id)"
    @dblclick="emit('play', track)"
    @keydown.enter="emit('select', track.id)"
  >
    <span class="library_row_cell" role="cell">
      <LibraryCoverCell :track="track" />
    </span>
    <span class="library_row_cell library_row_title" role="cell">
      <span class="library_row_text">{{ track.title }}</span>
      <span v-if="playing" class="library_row_badge library_row_badge_playing">
        <AppIcon name="play" />
        {{ t('library.row.playing') }}
      </span>
      <span v-if="track.missing" class="library_row_badge">
        <AppIcon name="warning" />
        {{ t('library.row.missing') }}
      </span>
    </span>
    <span class="library_row_cell" role="cell">{{ track.artist ?? t('library.row.unknown') }}</span>
    <span class="library_row_cell" role="cell">{{ track.album ?? t('library.row.unknown') }}</span>
    <span class="library_row_cell" role="cell">{{ track.year ?? t('library.row.unknown') }}</span>
    <span class="library_row_cell" role="cell">{{ track.genre ?? t('library.row.unknown') }}</span>
    <span class="library_row_cell library_row_duration" role="cell">
      {{ formatDuration(track.durationMs) }}
    </span>
    <span class="library_row_cell library_row_actions" role="cell">
      <LibraryRowActions
        :track="track"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
        @verify="emit('verify', $event)"
      />
    </span>
  </div>
</template>

<style scoped lang="scss">
.library_row {
  display: grid;
  grid-template-columns: var(--library_grid_columns);
  gap: $space_md;
  align-items: center;
  height: var(--library_row_height);
  padding: 0 $space_md;
  border-bottom: 1px solid var(--color_border);
  cursor: pointer;
  transition: background-color $duration_fast ease;

  &:hover {
    background-color: var(--color_surface_hover);
  }

  @include focus_ring;

  &_selected {
    background-color: var(--color_accent_soft);
  }

  &_missing {
    color: var(--color_text_muted);
  }

  &_playing {
    box-shadow: inset 3px 0 0 var(--color_accent);
    background-color: var(--color_accent_soft);
  }

  &_playing[style*='--cover_row_gradient'] {
    background: var(--cover_row_gradient), var(--color_surface);
  }

  &_cell {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_title {
    display: flex;
    gap: $space_sm;
    align-items: center;
    min-width: 0;
  }

  &_text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &_badge {
    display: inline-flex;
    gap: $space_2xs;
    align-items: center;
    flex-shrink: 0;
    padding: 0 $space_sm;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_sm;
    font-size: 0.75em;

    &_playing {
      border-color: var(--color_accent);
      color: var(--color_accent);
    }
  }

  &_duration {
    font-variant-numeric: tabular-nums;
  }

  &_actions {
    display: flex;
    gap: $space_xs;
    justify-content: flex-end;
    overflow: visible;
  }
}
</style>
