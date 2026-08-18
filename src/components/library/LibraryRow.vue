<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import LibraryCoverCell from '@/components/library/LibraryCoverCell.vue';
import { formatDuration } from '@/services/track-sorting';
import type { TrackView } from '@/types/library';

defineProps<{
  track: TrackView;
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  edit: [track: TrackView];
  remove: [track: TrackView];
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="library_row"
    :class="{ library_row_selected: selected, library_row_missing: track.missing }"
    role="row"
    tabindex="0"
    :aria-selected="selected"
    @click="emit('select', track.id)"
    @keydown.enter="emit('select', track.id)"
  >
    <span class="library_row_cell" role="cell">
      <LibraryCoverCell :track="track" />
    </span>
    <span class="library_row_cell library_row_title" role="cell">
      <span class="library_row_text">{{ track.title }}</span>
      <span v-if="track.missing" class="library_row_badge">
        <AppIcon name="warning" />
        {{ t('library.row.missing') }}
      </span>
    </span>
    <span class="library_row_cell" role="cell">{{ track.album ?? t('library.row.unknown') }}</span>
    <span class="library_row_cell" role="cell">{{ track.year ?? t('library.row.unknown') }}</span>
    <span class="library_row_cell" role="cell">{{ track.genre ?? t('library.row.unknown') }}</span>
    <span class="library_row_cell library_row_duration" role="cell">
      {{ formatDuration(track.durationMs) }}
    </span>
    <span class="library_row_cell library_row_actions" role="cell">
      <AppTooltip :text="t('library.row.edit', { title: track.title })">
        <AppButton
          variant="ghost"
          :disabled="track.missing"
          :aria-label="t('library.row.edit', { title: track.title })"
          @click.stop="emit('edit', track)"
        >
          <AppIcon name="edit" />
        </AppButton>
      </AppTooltip>
      <AppTooltip :text="t('library.row.remove', { title: track.title })">
        <AppButton
          variant="ghost"
          :aria-label="t('library.row.remove', { title: track.title })"
          @click.stop="emit('remove', track)"
        >
          <AppIcon name="remove" />
        </AppButton>
      </AppTooltip>
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
    flex-shrink: 0;
    padding: 0 $space_sm;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_sm;
    font-size: 0.75em;
  }

  &_duration {
    font-variant-numeric: tabular-nums;
  }

  &_actions {
    display: flex;
    gap: $space_xs;
    justify-content: flex-end;
  }
}
</style>
