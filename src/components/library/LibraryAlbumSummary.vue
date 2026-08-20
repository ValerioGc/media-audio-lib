<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import CoverImage from '@/components/library/CoverImage.vue';
import type { TrackView } from '@/types/library';

/** One artist of the album, ready to be opened as a group of its own. */
export interface AlbumSummaryArtist {
  key: string;
  name: string;
}

const props = defineProps<{
  name: string;
  coverTrack: TrackView | null;
  year: number | null;
  artists: readonly AlbumSummaryArtist[];
  genres: readonly string[];
  trackCount: number;
}>();

const emit = defineEmits<{ openArtist: [key: string] }>();

const { t } = useI18n();
</script>

<template>
  <div class="library_album_summary">
    <CoverImage
      v-if="props.coverTrack !== null"
      class="library_album_summary_cover"
      :track="props.coverTrack"
      size="card"
      eager
    />

    <!-- The fields speak for themselves here: no label in front of each one. -->
    <div class="library_album_summary_facts">
      <h3 class="library_album_summary_name" :title="props.name">{{ props.name }}</h3>

      <p v-if="props.year !== null" class="library_album_summary_year">{{ props.year }}</p>

      <p v-if="props.artists.length > 0" class="library_album_summary_artists">
        <button
          v-for="artist in props.artists"
          :key="artist.key"
          class="library_album_summary_artist"
          type="button"
          @click="emit('openArtist', artist.key)"
        >
          {{ artist.name }}
        </button>
      </p>

      <p v-if="props.genres.length > 0" class="library_album_summary_genres">
        {{ props.genres.join(', ') }}
      </p>

      <p class="library_album_summary_count">
        {{ t('library.groups.trackCount', { count: props.trackCount }, props.trackCount) }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.library_album_summary {
  display: flex;
  flex: 1;
  gap: $space_md;
  align-items: flex-start;
  min-width: 0;

  &_cover {
    width: 7rem;
    flex-shrink: 0;
    box-shadow: var(--shadow_card);
  }

  &_facts {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $space_2xs;
    min-width: 0;
  }

  &_name {
    overflow: hidden;
    color: var(--color_text);
    font-size: 1.25em;
    font-weight: 700;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_year {
    color: var(--color_text_muted);
    font-variant-numeric: tabular-nums;
  }

  &_artists {
    display: flex;
    flex-wrap: wrap;
    gap: $space_2xs $space_sm;
    min-width: 0;
  }

  &_artist {
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color_accent);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 0.15em;

    &:hover {
      color: var(--color_accent_hover);
    }

    @include focus_ring;
  }

  &_genres,
  &_count {
    overflow: hidden;
    color: var(--color_text_muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_count {
    font-size: 0.875em;
  }
}

@media (max-width: 560px) {
  .library_album_summary_cover {
    width: 5rem;
  }
}
</style>
