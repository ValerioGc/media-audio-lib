<script setup lang="ts">
import PreviewCard from '@/components/library/PreviewCard.vue';
import type { TrackSelectionIntent, TrackView } from '@/types/library';

defineProps<{
  tracks: readonly TrackView[];
  selectedIds: readonly string[];
  playingId: string | null;
}>();

const emit = defineEmits<{
  select: [intent: TrackSelectionIntent];
  play: [track: TrackView];
  edit: [track: TrackView];
  remove: [track: TrackView];
  verify: [track: TrackView];
}>();
</script>

<template>
  <ul class="preview_grid">
    <li v-for="track in tracks" :key="track.id" class="preview_grid_item">
      <PreviewCard
        :track="track"
        :selected="selectedIds.includes(track.id)"
        :playing="track.id === playingId"
        @select="emit('select', $event)"
        @play="emit('play', $event)"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
        @verify="emit('verify', $event)"
      />
    </li>
  </ul>
</template>

<style scoped lang="scss">
.preview_grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: $space_md;
  flex: 1;
  min-height: 0;
  margin: 0;
  padding-bottom: $space_md;
  padding-left: 0;
  overflow-x: hidden;
  list-style: none;

  @include scroll_area;

  // The item is a grid track first: without a floor of its own it grows to the width of the
  // longest line of its card, which pushes the grid into a sideways scroll.
  &_item {
    display: flex;
    min-width: 0;
  }
}
</style>
