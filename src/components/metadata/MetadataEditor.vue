<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppModal from '@/components/common/AppModal.vue';
import CoverPicker from '@/components/metadata/CoverPicker.vue';
import GenreSelect from '@/components/metadata/GenreSelect.vue';
import MetadataField from '@/components/metadata/MetadataField.vue';
import { formatBytes } from '@/services/file-size';
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

const { t, locale } = useI18n();
const library = useLibraryStore();

const draft = ref<DraftMetadata>(fromTrack(props.track));
const coverPreview = ref<string | null>(null);
const pendingCover = ref<Cover | null | undefined>(undefined);
const pendingAlbumCover = ref<{
  album: string;
  cover: Cover;
  currentId: string;
  targets: TrackView[];
} | null>(null);
const isBatchSaving = ref(false);

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

/**
 * The weight of a cover the shell refused to read, once the picker has nothing to show.
 *
 * Without this the editor would show an empty frame for a file that does have a cover,
 * and the user would have no way of telling why.
 */
const heavyCover = computed(() => {
  if (pendingCover.value !== undefined) {
    return null;
  }

  const bytes = library.heavyCoverBytes(props.track.id);

  return bytes === null ? null : formatBytes(bytes, locale.value);
});

const errors = computed(() => draftErrors(draft.value));
const canSave = computed(
  () => isDraftValid(draft.value) && !library.isSaving && !isBatchSaving.value,
);

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

function sameAlbum(left: string | null, right: string): boolean {
  return (left?.trim().toLocaleLowerCase() ?? '') === right.trim().toLocaleLowerCase();
}

function albumCoverTargets(album: string, currentId: string): TrackView[] {
  const cleanedAlbum = album.trim();

  if (cleanedAlbum.length === 0) {
    return [];
  }

  return library.tracks.filter(
    (track) => track.id !== currentId && sameAlbum(track.album, cleanedAlbum),
  );
}

async function saveCoverForTracks(ids: readonly string[], cover: Cover | null): Promise<boolean> {
  for (const id of ids) {
    const saved = await library.saveCover(id, cover);

    if (saved === null) {
      return false;
    }
  }

  return true;
}

async function applyAlbumCover(includeAlbumTracks: boolean) {
  const batch = pendingAlbumCover.value;

  if (batch === null) {
    return;
  }

  isBatchSaving.value = true;

  const ids = includeAlbumTracks
    ? [batch.currentId, ...batch.targets.map((track) => track.id)]
    : [batch.currentId];
  const saved = await saveCoverForTracks(ids, batch.cover);

  isBatchSaving.value = false;

  if (!saved) {
    return;
  }

  pendingAlbumCover.value = null;
  emit('close');
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
    if (pendingCover.value !== null) {
      const album = saved.album?.trim() ?? '';
      const targets = albumCoverTargets(album, saved.id);

      if (targets.length > 0) {
        pendingAlbumCover.value = {
          album,
          cover: pendingCover.value,
          currentId: saved.id,
          targets,
        };
        return;
      }
    }

    const withCover = await library.saveCover(saved.id, pendingCover.value);

    if (withCover === null) {
      return;
    }
  }

  emit('close');
}
</script>

<template>
  <AppModal :open="pendingAlbumCover === null" :title="t('metadata.title')" @close="emit('close')">
    <form class="metadata_editor" data-testid="metadata-editor" @submit.prevent="save">
      <MetadataField
        v-model="draft.title"
        :label="t('metadata.fields.title')"
        :error="messageFor(errors.title)"
      />
      <MetadataField
        v-model="draft.artist"
        :label="t('metadata.fields.artist')"
        :suggestions="library.artistSuggestions"
      />
      <MetadataField
        v-model="draft.album"
        :label="t('metadata.fields.album')"
        :suggestions="library.albumSuggestions"
      />
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
        :genres="library.genreSuggestions"
      />
      <CoverPicker :current="coverPreview" @select="onCoverSelected" @remove="onCoverRemoved" />

      <p v-if="heavyCover !== null" class="metadata_editor_warning" data-testid="cover-too-large">
        {{ t('metadata.cover.tooLarge', { size: heavyCover }) }}
      </p>
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

  <AppModal
    :open="pendingAlbumCover !== null"
    :title="t('metadata.cover.batch.title')"
    @close="applyAlbumCover(false)"
  >
    <p v-if="pendingAlbumCover !== null" class="metadata_editor_batch_message">
      {{
        t(
          'metadata.cover.batch.message',
          {
            album: pendingAlbumCover.album,
            count: pendingAlbumCover.targets.length,
          },
          pendingAlbumCover.targets.length,
        )
      }}
    </p>

    <template #actions>
      <AppButton
        :disabled="isBatchSaving"
        data-testid="cover-batch-current"
        @click="applyAlbumCover(false)"
      >
        {{ t('metadata.cover.batch.onlyCurrent') }}
      </AppButton>
      <AppButton
        variant="primary"
        :disabled="isBatchSaving"
        data-testid="cover-batch-confirm"
        @click="applyAlbumCover(true)"
      >
        {{ isBatchSaving ? t('metadata.saving') : t('metadata.cover.batch.allAlbum') }}
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

  &_batch_message {
    color: var(--color_text);
  }

  &_warning {
    padding: $space_sm $space_md;
    @include surface_panel($radius_md, var(--color_surface_alt));
    color: var(--color_text_muted);
    font-size: 0.875em;
  }
}
</style>
