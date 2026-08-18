<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import { useLibraryStore } from '@/stores/library';
import type { TrackView } from '@/types/library';

const props = defineProps<{ track: TrackView }>();

const { t } = useI18n();
const library = useLibraryStore();
const source = ref<string | null>(null);

watch(
  () => props.track,
  async (track) => {
    source.value = await library.loadCover(track);
  },
  { immediate: true },
);
</script>

<template>
  <div class="library_cover">
    <img
      v-if="source !== null"
      class="library_cover_image"
      :src="source"
      :alt="t('library.columns.cover')"
    />
    <AppIcon v-else class="library_cover_fallback" name="note" :label="t('library.row.noCover')" />
  </div>
</template>

<style scoped lang="scss">
.library_cover {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  overflow: hidden;
  border: 1px solid var(--color_border);
  border-radius: $radius_sm;
  background-color: var(--color_surface_alt);

  &_image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &_fallback {
    color: var(--color_text_muted);
  }
}
</style>
