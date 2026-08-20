<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppModal from '@/components/common/AppModal.vue';
import DefaultPlayerBanner from '@/components/library/DefaultPlayerBanner.vue';
import LibraryContentTabs from '@/components/library/LibraryContentTabs.vue';
import LibraryEmptyState from '@/components/library/LibraryEmptyState.vue';
import LibraryFacetList, {
  type FacetGroupOpenPayload,
} from '@/components/library/LibraryFacetList.vue';
import LibraryViewToggle from '@/components/library/LibraryViewToggle.vue';
import LibraryImportReport from '@/components/library/LibraryImportReport.vue';
import LibraryTable from '@/components/library/LibraryTable.vue';
import LibraryTitle from '@/components/library/LibraryTitle.vue';
import LibraryToolbar from '@/components/library/LibraryToolbar.vue';
import PreviewGrid from '@/components/library/PreviewGrid.vue';
import MetadataEditor from '@/components/metadata/MetadataEditor.vue';
import { useFileDrop } from '@/composables/useFileDrop';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { LibraryContentTab, TrackView } from '@/types/library';

const { t } = useI18n();
const library = useLibraryStore();
const settings = useSettingsStore();
const player = usePlayerStore();
const pendingRemoval = ref<TrackView | null>(null);
const selectedFacet = ref<FacetGroupOpenPayload | null>(null);
const activeTab = ref<LibraryContentTab>('tracks');

const activeFacet = computed<'artist' | 'album' | 'genre' | null>(() => {
  if (activeTab.value === 'artists') {
    return 'artist';
  }

  if (activeTab.value === 'albums') {
    return 'album';
  }

  if (activeTab.value === 'genres') {
    return 'genre';
  }

  return null;
});

const selectedFacetTracks = computed(() => {
  const facet = selectedFacet.value;

  if (facet === null) {
    return [];
  }

  return library.visibleTracks.filter((track) => facetKeyOf(track, facet.field) === facet.key);
});

const { isDraggingOver } = useFileDrop((paths) => {
  void library.addPaths(paths);
});

onMounted(() => {
  void library.load();
});

/** The visible list becomes the queue, so previous and next follow what is on screen. */
function startPlayback(track: TrackView) {
  void player.playFrom(library.visibleTracks, track.id);
}

function startFacetPlayback(track: TrackView) {
  void player.playFrom(selectedFacetTracks.value, track.id);
}

function facetKeyOf(track: TrackView, field: 'artist' | 'album' | 'genre') {
  const value = track[field]?.trim() ?? '';
  return value.length > 0 ? value : '__unknown__';
}

function askRemoval(track: TrackView) {
  selectedFacet.value = null;
  pendingRemoval.value = track;
}

function openEditor(track: TrackView) {
  selectedFacet.value = null;
  library.openEditor(track.id);
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
      <LibraryTitle />
      <LibraryToolbar />
    </header>

    <p v-if="library.errorKey !== null" class="library_view_error" role="alert">
      {{ t(`library.errors.${library.errorKey}`) }}
    </p>

    <DefaultPlayerBanner v-if="!settings.defaultPlayerBannerDismissed" />

    <p v-if="library.lastExport !== null" class="library_view_notice" role="status">
      {{ t('library.catalog.exported', { path: library.lastExport }) }}
      <AppButton variant="ghost" @click="library.dismissExport()">
        {{ t('library.report.dismiss') }}
      </AppButton>
    </p>

    <p v-if="library.lastLibraryImport !== null" class="library_view_notice" role="status">
      {{
        t('settings.importExport.report.summary', {
          total: library.lastLibraryImport.total,
          added: library.lastLibraryImport.added,
          updated: library.lastLibraryImport.updated,
          skipped: library.lastLibraryImport.skipped,
          missing: library.lastLibraryImport.missing.length,
        })
      }}
      <AppButton variant="ghost" @click="library.dismissLibraryImport()">
        {{ t('library.report.dismiss') }}
      </AppButton>
    </p>

    <p v-if="library.lastVerification !== null" class="library_view_notice" role="status">
      {{
        t('library.verification.summary', {
          total: library.lastVerification.total,
          missing: library.lastVerification.missing,
        })
      }}
      <AppButton variant="ghost" @click="library.dismissVerification()">
        {{ t('library.report.dismiss') }}
      </AppButton>
    </p>

    <LibraryImportReport
      v-if="library.lastReport !== null"
      :report="library.lastReport"
      @dismiss="library.dismissReport()"
    />

    <LibraryEmptyState v-if="library.isEmpty" variant="empty" />
    <template v-else>
      <LibraryContentTabs v-model="activeTab" />

      <section
        :id="`library-panel-${activeTab}`"
        class="library_view_panel"
        role="tabpanel"
        :aria-labelledby="`library-tab-${activeTab}`"
      >
        <LibraryEmptyState v-if="library.hasNoMatches" variant="noMatches" />
        <PreviewGrid
          v-else-if="activeTab === 'tracks' && settings.viewMode === 'preview'"
          :tracks="library.visibleTracks"
          :selected-id="library.selectedId"
          :playing-id="player.currentTrack?.id ?? null"
          @select="library.select($event)"
          @play="startPlayback($event)"
          @edit="library.openEditor($event.id)"
          @remove="askRemoval"
          @verify="library.verifyTrack($event)"
        />
        <LibraryTable
          v-else-if="activeTab === 'tracks'"
          :tracks="library.visibleTracks"
          :sort="library.sort"
          :selected-id="library.selectedId"
          :playing-id="player.currentTrack?.id ?? null"
          @sort="library.toggleSort($event)"
          @select="library.select($event)"
          @play="startPlayback($event)"
          @edit="library.openEditor($event.id)"
          @remove="askRemoval"
          @verify="library.verifyTrack($event)"
        />
        <LibraryFacetList
          v-else-if="activeFacet !== null"
          :tracks="library.visibleTracks"
          :field="activeFacet"
          :view-mode="settings.viewMode"
          @open="selectedFacet = $event"
        />
      </section>
    </template>

    <AppModal
      :open="selectedFacet !== null"
      :title="t('library.groups.modalTitle', { name: selectedFacet?.name ?? '' })"
      wide
      @close="selectedFacet = null"
    >
      <div class="library_view_group_modal">
        <div class="library_view_group_modal_header">
          <p>
            {{
              t(
                'library.groups.trackCount',
                { count: selectedFacetTracks.length },
                selectedFacetTracks.length,
              )
            }}
          </p>
          <LibraryViewToggle />
        </div>

        <PreviewGrid
          v-if="settings.viewMode === 'preview'"
          :tracks="selectedFacetTracks"
          :selected-id="library.selectedId"
          :playing-id="player.currentTrack?.id ?? null"
          @select="library.select($event)"
          @play="startFacetPlayback($event)"
          @edit="openEditor"
          @remove="askRemoval"
          @verify="library.verifyTrack($event)"
        />
        <LibraryTable
          v-else
          :tracks="selectedFacetTracks"
          :sort="library.sort"
          :selected-id="library.selectedId"
          :playing-id="player.currentTrack?.id ?? null"
          @sort="library.toggleSort($event)"
          @select="library.select($event)"
          @play="startFacetPlayback($event)"
          @edit="openEditor"
          @remove="askRemoval"
          @verify="library.verifyTrack($event)"
        />
      </div>

      <template #actions>
        <AppButton @click="selectedFacet = null">{{ t('library.groups.close') }}</AppButton>
      </template>
    </AppModal>

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

  &_notice {
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
    padding: $space_sm $space_md;
    font-size: 0.875em;

    @include surface_panel($radius_md, var(--color_surface_alt));
    overflow-wrap: anywhere;
  }

  &_error {
    padding: $space_sm $space_md;
    color: var(--color_text);

    @include surface_panel($radius_md, var(--color_surface_alt));

    border-color: var(--color_border_strong);
  }

  &_panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  &_group_modal {
    display: flex;
    flex-direction: column;
    gap: $space_md;
    min-height: min(32rem, 70vh);

    &_header {
      display: flex;
      gap: $space_md;
      align-items: center;
      justify-content: space-between;
      color: var(--color_text_muted);
      font-size: 0.875em;
    }
  }
}
</style>
