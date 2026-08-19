<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppModal from '@/components/common/AppModal.vue';
import CoverPicker from '@/components/metadata/CoverPicker.vue';
import GenreSelect from '@/components/metadata/GenreSelect.vue';
import MetadataField from '@/components/metadata/MetadataField.vue';
import {
  draftErrors,
  isDraftValid,
  toUpdate,
  type DraftMetadata,
} from '@/services/metadata-validation';
import { useLibraryStore } from '@/stores/library';
import type { Cover, TrackView } from '@/types/library';

const props = defineProps<{ track: TrackView }>();

const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const library = useLibraryStore();

const draft = ref<DraftMetadata>(fromTrack(props.track));
const coverPreview = ref<string | null>(null);
const pendingCover = ref<Cover | null | undefined>(undefined);

function fromTrack(track: TrackView): DraftMetadata {
  return {
    title: track.title,
    artist: track.artist ?? '',
    album: track.album ?? '',
    year: track.year === null ? '' : String(track.year),
    genre: track.genre ?? '',
  };
}

watch(
  () => props.track,
  async (track) => {
    draft.value = fromTrack(track);
    pendingCover.value = undefined;
    coverPreview.value = await library.loadCover(track);
  },
  { immediate: true },
);

const errors = computed(() => draftErrors(draft.value));
const canSave = computed(() => isDraftValid(draft.value) && !library.isSaving);

function messageFor(key: string | null) {
  return key === null ? null : t(`metadata.errors.${key}`);
}

function onCoverSelected(cover: Cover) {
  pendingCover.value = cover;
}

function onCoverRemoved() {
  pendingCover.value = null;
  coverPreview.value = null;
}

async function save() {
  if (!canSave.value) {
    return;
  }

  const saved = await library.saveMetadata(props.track.id, toUpdate(draft.value));
  if (saved === null) {
    return;
  }

  if (pendingCover.value !== undefined) {
    const withCover = await library.saveCover(props.track.id, pendingCover.value);
    if (withCover === null) {
      return;
    }
  }

  emit('close');
}
</script>

<template>
  <AppModal :open="true" :title="t('metadata.title')" @close="emit('close')">
    <form class="metadata_editor" data-testid="metadata-editor" @submit.prevent="save">
      <MetadataField
        v-model="draft.title"
        :label="t('metadata.fields.title')"
        :error="messageFor(errors.title)"
      />
      <MetadataField v-model="draft.artist" :label="t('metadata.fields.artist')" />
      <MetadataField v-model="draft.album" :label="t('metadata.fields.album')" />
      <MetadataField
        v-model="draft.year"
        :label="t('metadata.fields.year')"
        :error="messageFor(errors.year)"
        placeholder="1999"
      />
      <GenreSelect
        v-model="draft.genre"
        :label="t('metadata.fields.genre')"
        :custom-label="t('metadata.fields.genreCustom')"
      />
      <CoverPicker :current="coverPreview" @select="onCoverSelected" @remove="onCoverRemoved" />
    </form>

    <template #actions>
      <AppButton :disabled="library.isSaving" @click="emit('close')">
        {{ t('metadata.cancel') }}
      </AppButton>
      <AppButton variant="primary" :disabled="!canSave" data-testid="metadata-save" @click="save">
        {{ library.isSaving ? t('metadata.saving') : t('metadata.save') }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.metadata_editor {
  display: flex;
  flex-direction: column;
  gap: $space_md;
  text-align: left;
}
</style>
