<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import { useLibraryStore } from '@/stores/library';
import type { TrackView } from '@/types/library';

const props = withDefaults(
  defineProps<{
    track: TrackView;
    size?: 'thumb' | 'card' | 'fill';
    /** Skips the visibility check, for lists that already render only what is on screen. */
    eager?: boolean;
  }>(),
  { size: 'thumb', eager: false },
);

const { t } = useI18n();
const library = useLibraryStore();

const root = ref<HTMLElement | null>(null);
const source = ref<string | null>(null);
const isVisible = ref(false);
let observer: IntersectionObserver | null = null;

function stopObserving() {
  observer?.disconnect();
  observer = null;
}

async function loadCover() {
  source.value = await library.loadCover(props.track);
}

function reveal() {
  isVisible.value = true;
  stopObserving();
  // Reached from an observer callback too: `loadCover` reports a failure as a null cover
  // instead of rejecting, so there is no result left to hand back.
  loadCover();
}

onMounted(() => {
  // Without an observer (older webviews, jsdom) the image is simply loaded right away.
  if (props.eager || typeof IntersectionObserver === 'undefined' || root.value === null) {
    reveal();
    return;
  }

  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      reveal();
    }
  });
  observer.observe(root.value);
});

onBeforeUnmount(stopObserving);

watch(
  () => props.track,
  () => {
    source.value = null;

    if (isVisible.value) {
      loadCover();
    }
  },
);
</script>

<template>
  <div ref="root" class="cover_image" :class="`cover_image_${size}`">
    <img
      v-if="source !== null"
      class="cover_image_picture"
      :src="source"
      :alt="t('library.columns.cover')"
    />
    <AppIcon v-else class="cover_image_fallback" name="note" :label="t('library.row.noCover')" />
  </div>
</template>

<style scoped lang="scss">
.cover_image {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--color_border);
  background-color: var(--color_surface_alt);
  color: var(--color_text_muted);

  &_thumb {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: $radius_sm;
  }

  // The square is reserved by the padding, not by the picture: a card keeps the same height
  // while its cover loads, and `aspect-ratio` alone would not, since a column flex item is
  // measured before its width is stretched.
  &_card {
    position: relative;
    width: 100%;
    height: 0;
    padding-bottom: 100%;
    border-radius: $radius_md;
    font-size: 2rem;

    > * {
      position: absolute;
      display: flex;
      inset: 0;
      align-items: center;
      justify-content: center;
    }
  }

  // Sized by the height of its row, which already follows the width of the cover column.
  // Driving it from the cell instead would stretch it: in a table laid out to fit, that
  // column is a fraction of the free space and can be far wider than it is tall.
  &_fill {
    width: auto;
    height: 100%;
    max-width: 100%;
    aspect-ratio: 1;
    border-radius: $radius_sm;
  }

  &_picture {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
</style>
