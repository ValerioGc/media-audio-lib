<script setup lang="ts">
import PreviewCard from '@/components/library/PreviewCard.vue';
import type { TrackSelectionIntent, TrackView } from '@/types/library';

defineProps<{
  tracks: readonly TrackView[];
  selectedIds: readonly string[];
  playingId: string | null;
}>();

/**
 * A listbox rather than a list: these cards are selected, one or several at a time, which
 * is what `aria-selected` on each of them reports.
 */
const emit = defineEmits<{
  select: [intent: TrackSelectionIntent];
  play: [track: TrackView];
  edit: [track: TrackView];
  remove: [track: TrackView];
  verify: [track: TrackView];
}>();
</script>

<template>
  <div class="preview_grid" role="listbox" aria-multiselectable="true">
    <PreviewCard
      v-for="track in tracks"
      :key="track.id"
      :track="track"
      :selected="selectedIds.includes(track.id)"
      :playing="track.id === playingId"
      @select="emit('select', $event)"
      @play="emit('play', $event)"
      @edit="emit('edit', $event)"
      @remove="emit('remove', $event)"
      @verify="emit('verify', $event)"
    />
  </div>
</template>

<style scoped lang="scss">
.preview_grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: $space_md;
  flex: 1;
  min-height: 0;
  padding-bottom: $space_md;

  @include scroll_area;
}
</style>
