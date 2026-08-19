<script setup lang="ts">
import PreviewCard from '@/components/library/PreviewCard.vue';
import type { TrackView } from '@/types/library';

defineProps<{
  tracks: readonly TrackView[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
  edit: [track: TrackView];
}>();
</script>

<template>
  <div class="preview_grid" role="list" :aria-rowcount="tracks.length">
    <div v-for="track in tracks" :key="track.id" class="preview_grid_item" role="listitem">
      <PreviewCard
        :track="track"
        :selected="track.id === selectedId"
        @select="emit('select', $event)"
        @edit="emit('edit', $event)"
      />
    </div>
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
  overflow-y: auto;
}
</style>
