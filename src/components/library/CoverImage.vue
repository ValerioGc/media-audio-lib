<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import { useLibraryStore } from '@/stores/library';
import type { TrackView } from '@/types/library';

const props = withDefaults(
  defineProps<{
    track: TrackView;
    /**
     * Each size has a class of its own, spelled out in the template: a name built from this
     * prop would never reach the stylesheet, which is purged against what the sources say.
     */
    size?: 'thumb' | 'card' | 'fill';
    /** Loads the picture at once rather than when it comes into view. */
    eager?: boolean;
  }>(),
  { size: 'thumb', eager: false },
);

const { t } = useI18n();
const library = useLibraryStore();

/**
 * The address of the picture, which is all this component needs.
 *
 * There is no fetching to orchestrate here any more, and no observer: the picture is an
 * ordinary image at an ordinary address, so the browser fetches it, decodes it off the main
 * thread, keeps it while it is useful and drops it when it is not — and `loading="lazy"`
 * makes it wait until the row is close to the screen.
 */
const source = computed(() => library.coverUrl(props.track));

/** A file whose picture the shell will not serve: too heavy, or a format it does not read. */
const failed = ref(false);

watch(source, () => {
  failed.value = false;
});
</script>

<template>
  <div
    class="cover_image"
    :class="{
      cover_image_thumb: size === 'thumb',
      cover_image_card: size === 'card',
      cover_image_fill: size === 'fill',
    }"
  >
    <img
      v-if="source !== null && !failed"
      class="cover_image_picture"
      :src="source"
      :alt="t('library.columns.cover')"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      @error="failed = true"
    />
    <span v-else class="cover_image_fallback" role="img" :aria-label="t('library.row.noCover')">
      <AppIcon name="note" />
    </span>
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

  // The square comes from the ratio rather than from a spacer with a percentage padding.
  //
  // A percentage counts as nothing while a browser works out how tall something wants to
  // be, so a card holding one of these measured as tall as its text alone: the row came out
  // short and every cover spilled over the row beneath it, hiding the writing there. The
  // ratio is part of the measurement, which is the whole difference.
  &_card {
    width: 100%;
    aspect-ratio: 1;
    border-radius: $radius_md;
    font-size: 2rem;
  }

  // Every corner of the cell it is given. The column is a set number of pixels and the row
  // follows it, so the two agree on a square — and where they do not, the picture is cropped
  // by `object-fit` rather than leaving the cell showing around it.
  &_fill {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }

  &_picture {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &_fallback {
    display: flex;
    position: relative;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background:
      radial-gradient(
        circle at 22% 18%,
        color-mix(in srgb, var(--color_accent) 32%, transparent) 0 18%,
        transparent 52%
      ),
      radial-gradient(
        circle at 82% 86%,
        color-mix(in srgb, var(--color_accent) 20%, transparent) 0 14%,
        transparent 48%
      ),
      linear-gradient(135deg, var(--color_surface_alt), var(--color_bg_accent));
    color: var(--color_accent);

    &::before,
    &::after {
      position: absolute;
      border: 1px solid color-mix(in srgb, var(--color_accent) 28%, transparent);
      border-radius: 50%;
      content: '';
    }

    &::before {
      width: 68%;
      height: 68%;
      transform: rotate(-18deg);
    }

    &::after {
      width: 42%;
      height: 42%;
      transform: translate(20%, 20%);
    }

    :deep(.app_icon) {
      position: relative;
      z-index: 1;
      padding: 0.3em;
      border-radius: 50%;
      background-color: color-mix(in srgb, var(--color_surface) 72%, transparent);
      box-shadow: var(--shadow_card);
      font-size: 1.2em;
    }
  }
}
</style>
