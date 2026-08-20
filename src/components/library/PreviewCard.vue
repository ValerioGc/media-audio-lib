<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import LibraryRowActions from '@/components/library/LibraryRowActions.vue';
import PlayingBubble from '@/components/library/PlayingBubble.vue';
import type { TrackSelectionIntent, TrackView } from '@/types/library';

const props = defineProps<{
  track: TrackView;
  selected: boolean;
  playing: boolean;
}>();

const emit = defineEmits<{
  select: [intent: TrackSelectionIntent];
  play: [track: TrackView];
  edit: [track: TrackView];
  remove: [track: TrackView];
  verify: [track: TrackView];
}>();

const { t } = useI18n();

function select(event: MouseEvent | KeyboardEvent) {
  emit('select', {
    id: props.track.id,
    additive: event instanceof MouseEvent && (event.ctrlKey || event.metaKey),
    range: event.shiftKey,
  });
}
</script>

<template>
  <article
    class="preview_card"
    :class="{
      preview_card_selected: selected,
      preview_card_missing: track.missing,
      preview_card_playing: playing,
    }"
    tabindex="0"
    :aria-selected="selected"
    :aria-current="playing ? 'true' : undefined"
    @click="select($event)"
    @dblclick="emit('play', track)"
    @keydown.enter="select($event)"
  >
    <PlayingBubble v-if="playing" />

    <CoverImage :track="track" size="card" />

    <div class="preview_card_body">
      <h3 class="preview_card_title" :title="track.title">{{ track.title }}</h3>
      <p class="preview_card_meta" :title="track.artist ?? ''">
        {{ track.artist ?? t('library.row.unknown') }}
      </p>
      <p class="preview_card_meta">{{ track.album ?? t('library.row.unknown') }}</p>
      <p v-if="track.missing" class="preview_card_badge">
        <AppIcon name="warning" />
        {{ t('library.row.missing') }}
      </p>
    </div>

    <!-- Same menu as the list view, so both views offer the same actions. -->
    <div class="preview_card_actions">
      <LibraryRowActions
        :track="track"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
        @verify="emit('verify', $event)"
      />
    </div>
  </article>
</template>

<style scoped lang="scss">
.preview_card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: $space_sm;
  padding: $space_sm;
  @include glass_surface($radius_lg);
  cursor: pointer;
  transition:
    background-color $duration_fast ease,
    border-color $duration_fast ease;

  &:hover {
    background-color: var(--row_hover_background);
  }

  @include focus_ring;

  &_selected {
    border-color: var(--color_accent);
    background-color: var(--row_selected_background);
  }

  &_missing {
    color: var(--color_text_muted);
  }

  &_playing {
    border-color: var(--color_accent);
    box-shadow: inset 0 0 0 1px var(--color_accent);
    background-color: var(--row_selected_background);
  }

  &_body {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    min-width: 0;
  }

  &_title {
    overflow: hidden;
    font-size: 0.9375em;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_meta {
    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.8125em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_badge {
    display: flex;
    gap: $space_xs;
    align-items: center;
    font-size: 0.75em;
  }

  // The menu takes the same corner: reading the state matters while the card is at rest,
  // acting on it matters while the pointer is on the card.
  &:hover :deep(.playing_bubble),
  &:focus-within :deep(.playing_bubble) {
    opacity: 0;
  }

  &_actions {
    position: absolute;
    top: $space_sm;
    right: $space_sm;
    border-radius: $radius_md;
    background-color: var(--surface_glass_background);
    opacity: 0;
    transition: opacity $duration_fast ease;
  }

  // The menu stays visible while it is open, otherwise it would vanish under the pointer.
  &:hover &_actions,
  &:focus-within &_actions,
  &_actions:has([aria-expanded='true']) {
    opacity: 1;
  }
}
</style>
