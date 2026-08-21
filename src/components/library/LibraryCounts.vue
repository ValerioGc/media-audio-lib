<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useLibraryStore } from '@/stores/library';
import type { LibraryContentTab } from '@/types/library';

const props = withDefaults(defineProps<{ tab?: LibraryContentTab }>(), { tab: 'tracks' });

const { t } = useI18n();
const library = useLibraryStore();

/**
 * What the open tab is about, counted.
 *
 * A tab answers for its own subject, so it carries that count alone. A genre is the one
 * that gathers the others: beside how many there are, it says what they hold.
 */
const counts = computed(() => {
  const entries = {
    tracks: [{ key: 'track', label: t('library.toolbar.count', library.tracks.length) }],
    artists: [{ key: 'artist', label: t('library.groups.artistCount', library.artistCount) }],
    albums: [{ key: 'album', label: t('library.groups.albumCount', library.albumCount) }],
    genres: [
      { key: 'genre', label: t('library.groups.genreCount', library.genreCount) },
      { key: 'artist', label: t('library.groups.artistCount', library.artistCount) },
      { key: 'album', label: t('library.groups.albumCount', library.albumCount) },
    ],
  } as const satisfies Record<LibraryContentTab, readonly { key: string; label: string }[]>;

  return entries[props.tab];
});
</script>

<template>
  <p class="library_counts">
    <span v-for="count in counts" :key="count.key" :data-testid="`${count.key}-count`">{{
      count.label
    }}</span>

    <span v-if="library.missingCount > 0" class="library_counts_flag">
      {{ t('library.toolbar.missing', { count: library.missingCount }, library.missingCount) }}
    </span>

    <span
      v-if="library.missingInfoFilter !== 'all'"
      class="library_counts_flag"
      data-testid="missing-info-active"
    >
      {{
        t('library.toolbar.missingInfo.active', {
          filter: t(`library.toolbar.missingInfo.options.${library.missingInfoFilter}`),
        })
      }}
    </span>
  </p>
</template>

<style scoped lang="scss">
.library_counts {
  display: flex;
  flex-wrap: wrap;
  gap: $space_xs $space_sm;
  align-items: center;
  justify-content: flex-end;
  color: var(--color_text_muted);
  font-size: 0.875em;

  &_flag {
    padding: 0 $space_sm;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_sm;
  }
}
</style>
