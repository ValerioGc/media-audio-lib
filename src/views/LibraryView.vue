<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppModal from '@/components/common/AppModal.vue';
import LibraryEmptyState from '@/components/library/LibraryEmptyState.vue';
import LibraryImportReport from '@/components/library/LibraryImportReport.vue';
import LibraryTable from '@/components/library/LibraryTable.vue';
import LibraryToolbar from '@/components/library/LibraryToolbar.vue';
import PreviewGrid from '@/components/library/PreviewGrid.vue';
import MetadataEditor from '@/components/metadata/MetadataEditor.vue';
import { useFileDrop } from '@/composables/useFileDrop';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { TrackView } from '@/types/library';

const { t } = useI18n();
const library = useLibraryStore();
const settings = useSettingsStore();
const player = usePlayerStore();
const pendingRemoval = ref<TrackView | null>(null);

const { isDraggingOver } = useFileDrop((paths) => {
  void library.addPaths(paths);
});

onMounted(() => {
  void library.load();
});

function askRemoval(track: TrackView) {
  pendingRemoval.value = track;
}

async function confirmRemoval() {
  const track = pendingRemoval.value;
  pendingRemoval.value = null;

  if (track !== null) {
    await library.remove(track.id);
  }
}
</script>

<template>
  <div class="library_view" :class="{ library_view_dropping: isDraggingOver }">
    <header class="library_view_header">
      <h1 class="library_view_title">{{ t('library.title') }}</h1>
      <LibraryToolbar />
    </header>

    <p v-if="library.errorKey !== null" class="library_view_error" role="alert">
      {{ t(`library.errors.${library.errorKey}`) }}
    </p>

    <LibraryImportReport
      v-if="library.lastReport !== null"
      :report="library.lastReport"
      @dismiss="library.dismissReport()"
    />

    <LibraryEmptyState v-if="library.isEmpty" variant="empty" />
    <LibraryEmptyState v-else-if="library.hasNoMatches" variant="noMatches" />
    <PreviewGrid
      v-else-if="settings.viewMode === 'preview'"
      :tracks="library.visibleTracks"
      :selected-id="library.selectedId"
      @select="library.select($event)"
      @play="player.play($event)"
      @edit="library.openEditor($event.id)"
    />
    <LibraryTable
      v-else
      :tracks="library.visibleTracks"
      :sort="library.sort"
      :selected-id="library.selectedId"
      @sort="library.toggleSort($event)"
      @select="library.select($event)"
      @play="player.play($event)"
      @edit="library.openEditor($event.id)"
      @remove="askRemoval"
    />

    <MetadataEditor
      v-if="library.editingTrack !== null"
      :track="library.editingTrack"
      @close="library.closeEditor()"
    />

    <AppModal
      :open="pendingRemoval !== null"
      :title="t('library.remove.title')"
      @close="pendingRemoval = null"
    >
      {{ t('library.remove.message', { title: pendingRemoval?.title ?? '' }) }}
      <template #actions>
        <AppButton @click="pendingRemoval = null">{{ t('library.remove.cancel') }}</AppButton>
        <AppButton variant="danger" data-testid="confirm-remove" @click="confirmRemoval">
          {{ t('library.remove.confirm') }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped lang="scss">
.library_view {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $space_md;
  min-height: 0;
  border: 2px dashed transparent;
  border-radius: $radius_lg;
  transition: border-color $duration_fast ease;

  &_dropping {
    border-color: var(--color_accent);
  }

  &_header {
    display: flex;
    flex-direction: column;
    gap: $space_md;
  }

  &_title {
    font-size: 1.75em;
    font-weight: 600;
  }

  &_error {
    padding: $space_sm $space_md;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_md;
    background-color: var(--color_surface_alt);
    color: var(--color_text);
  }
}
</style>
