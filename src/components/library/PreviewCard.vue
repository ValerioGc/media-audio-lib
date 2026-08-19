<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import type { TrackView } from '@/types/library';

defineProps<{
  track: TrackView;
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  play: [track: TrackView];
  edit: [track: TrackView];
}>();

const { t } = useI18n();
</script>

<template>
  <article
    class="preview_card"
    :class="{ preview_card_selected: selected, preview_card_missing: track.missing }"
    tabindex="0"
    :aria-selected="selected"
    @click="emit('select', track.id)"
    @dblclick="emit('play', track)"
    @keydown.enter="emit('select', track.id)"
  >
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

    <AppButton
      class="preview_card_edit"
      variant="ghost"
      :disabled="track.missing"
      :aria-label="t('library.row.edit', { title: track.title })"
      @click.stop="emit('edit', track)"
    >
      <AppIcon name="edit" />
    </AppButton>
  </article>
</template>

<style scoped lang="scss">
.preview_card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: $space_sm;
  padding: $space_sm;
  border: 1px solid var(--color_border);
  border-radius: $radius_lg;
  background-color: var(--color_surface);
  cursor: pointer;
  transition:
    background-color $duration_fast ease,
    border-color $duration_fast ease;

  &:hover {
    background-color: var(--color_surface_hover);
  }

  @include focus_ring;

  &_selected {
    border-color: var(--color_accent);
    background-color: var(--color_accent_soft);
  }

  &_missing {
    color: var(--color_text_muted);
  }

  &_body {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
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

  &_edit {
    position: absolute;
    top: $space_sm;
    right: $space_sm;
    background-color: var(--color_surface);
    opacity: 0;
    transition: opacity $duration_fast ease;
  }

  &:hover &_edit,
  &:focus-within &_edit {
    opacity: 1;
  }
}
</style>
