<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import PlayingBubble from '@/components/library/PlayingBubble.vue';
import type { IconName } from '@/config/icons';
import type { TrackView } from '@/types/library';

/** One entry of the carousel: an album or an artist gathered from the open group. */
export interface CarouselGroup {
  key: string;
  name: string;
  /** Second line of the card: the year of an album, the track count of an artist. */
  meta: string | null;
  coverTrack: TrackView | null;
  playing: boolean;
}

const props = withDefaults(
  defineProps<{
    title: string;
    groups: readonly CarouselGroup[];
    actionLabel: string;
    actionIcon: IconName;
    /** Roomier cards, for when the carousel is the subject rather than a summary. */
    large?: boolean;
  }>(),
  { large: false },
);

const emit = defineEmits<{
  open: [key: string];
  action: [];
}>();

const { t } = useI18n();
</script>

<template>
  <section
    class="library_group_carousel"
    :class="{ library_group_carousel_large: props.large }"
    :aria-label="props.title"
  >
    <header class="library_group_carousel_header">
      <h3 class="library_group_carousel_title">{{ props.title }}</h3>
      <AppTooltip :text="props.actionLabel">
        <AppButton
          class="library_group_carousel_action"
          variant="ghost"
          :aria-label="props.actionLabel"
          data-testid="carousel-action"
          @click="emit('action')"
        >
          <AppIcon :name="props.actionIcon" />
        </AppButton>
      </AppTooltip>
    </header>

    <div class="library_group_carousel_track" role="list">
      <button
        v-for="group in props.groups"
        :key="group.key"
        class="library_group_carousel_card"
        :class="{ library_group_carousel_card_playing: group.playing }"
        type="button"
        :aria-label="t('library.groups.openLabel', { name: group.name })"
        :aria-current="group.playing ? 'true' : undefined"
        @click="emit('open', group.key)"
      >
        <PlayingBubble v-if="group.playing" />

        <CoverImage
          v-if="group.coverTrack !== null"
          class="library_group_carousel_cover"
          :track="group.coverTrack"
          size="card"
          eager
        />
        <span class="library_group_carousel_name" :title="group.name">{{ group.name }}</span>
        <span v-if="group.meta !== null" class="library_group_carousel_meta">
          {{ group.meta }}
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.library_group_carousel {
  display: flex;
  flex-direction: column;
  gap: $space_sm;
  min-width: 0;

  &_header {
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
  }

  &_title {
    color: var(--color_text);
    font-size: 0.95em;
    font-weight: 700;
  }

  &_action {
    width: 2rem;
    height: 2rem;
    min-height: 2rem;
    padding: 0;
  }

  &_track {
    display: flex;
    gap: $space_md;
    min-width: 0;
    padding-bottom: $space_xs;
    overflow-x: auto;
    scroll-snap-type: x proximity;
  }

  &_card {
    display: flex;
    position: relative;
    flex: 0 0 8.5rem;
    flex-direction: column;
    gap: $space_xs;
    padding: $space_sm;
    color: var(--color_text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    scroll-snap-align: start;
    transition:
      background-color $duration_fast ease,
      border-color $duration_fast ease;

    @include glass_surface($radius_md);

    &:hover {
      background-color: var(--row_hover_background);
    }

    @include focus_ring;

    &_playing {
      border-color: var(--color_accent);
      background-color: var(--row_selected_background);
      box-shadow: inset 0 0 0 1px var(--color_accent);
    }
  }

  &_large &_card {
    flex-basis: 12rem;
  }

  &_cover {
    width: 100%;
    flex-shrink: 0;
  }

  &_name,
  &_meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_name {
    font-size: 0.875em;
    font-weight: 700;
  }

  &_meta {
    color: var(--color_text_muted);
    font-size: 0.8em;
    font-variant-numeric: tabular-nums;
  }
}

@media (max-width: 640px) {
  .library_group_carousel {
    &_card {
      flex-basis: 7.5rem;
    }

    &_large &_card {
      flex-basis: 10rem;
    }
  }
}
</style>
