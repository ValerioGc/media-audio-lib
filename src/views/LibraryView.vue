<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/AppModal.vue';
import CoverImage from '@/components/library/CoverImage.vue';
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
import BulkMetadataEditor from '@/components/metadata/BulkMetadataEditor.vue';
import MetadataEditor from '@/components/metadata/MetadataEditor.vue';
import { useFileDrop } from '@/composables/useFileDrop';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { LibraryContentTab, TrackSelectionIntent, TrackView } from '@/types/library';
import type { TableColumnKey, ViewMode } from '@/types/settings';

const { t } = useI18n();
const library = useLibraryStore();
const settings = useSettingsStore();
const player = usePlayerStore();
const pendingRemoval = ref<TrackView | null>(null);
const selectedFacet = ref<FacetGroupOpenPayload | null>(null);
const activeTab = ref<LibraryContentTab>('tracks');
const facetViewMode = ref<ViewMode>('preview');
const groupModalViewMode = ref<ViewMode>('preview');
const genreModalTab = ref<'tracks' | 'artists' | 'albums'>('tracks');
const isArtistAlbumsExpanded = ref(false);
const selectionAnchorId = ref<string | null>(null);
const isBulkEditorOpen = ref(false);
const artistModalHiddenColumnKeys = [
  'artist',
  'genre',
  'format',
  'path',
  'missing',
] as const satisfies readonly TableColumnKey[];

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

interface ModalAlbumGroup {
  key: string;
  name: string;
  year: number | null;
  tracks: TrackView[];
  coverTrack: TrackView | null;
  isUnknown: boolean;
}

const selectedFacetAlbums = computed<ModalAlbumGroup[]>(() => {
  const grouped = new Map<string, TrackView[]>();

  for (const track of selectedFacetTracks.value) {
    const value = track.album?.trim() ?? '';
    const key = value.length > 0 ? value : '__unknown__';
    grouped.set(key, [...(grouped.get(key) ?? []), track]);
  }

  return [...grouped.entries()]
    .map(([key, tracks]) => {
      const isUnknown = key === '__unknown__';

      return {
        key,
        name: isUnknown ? t('library.groups.unknown.album') : key,
        year: tracks.find((track) => track.year !== null)?.year ?? null,
        tracks,
        coverTrack: tracks.find((track) => track.hasCover && !track.missing) ?? tracks[0] ?? null,
        isUnknown,
      };
    })
    .sort((left, right) => {
      if (left.isUnknown !== right.isUnknown) {
        return left.isUnknown ? 1 : -1;
      }

      if (left.year !== right.year && left.year !== null && right.year !== null) {
        return left.year - right.year;
      }

      return left.name.localeCompare(right.name);
    });
});

const displayedViewMode = computed(() =>
  activeTab.value === 'tracks' ? settings.viewMode : facetViewMode.value,
);

const { isDraggingOver } = useFileDrop((paths) => {
  void library.addPaths(paths);
});

onMounted(() => {
  void library.loadHomeLibrary(settings.mainLibraryId);
});

watch(
  () => settings.mainLibraryId,
  (mainLibraryId) => {
    if (settings.isReady && mainLibraryId !== null) {
      void library.loadHomeLibrary(mainLibraryId);
    }
  },
);

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

function openFacet(group: FacetGroupOpenPayload) {
  groupModalViewMode.value = facetViewMode.value;
  genreModalTab.value = 'tracks';
  isArtistAlbumsExpanded.value = false;
  selectedFacet.value = group;
}

function selectFromTracks(intent: TrackSelectionIntent, tracks: readonly TrackView[]) {
  if (intent.range && selectionAnchorId.value !== null) {
    const anchorIndex = tracks.findIndex((track) => track.id === selectionAnchorId.value);
    const targetIndex = tracks.findIndex((track) => track.id === intent.id);

    if (anchorIndex >= 0 && targetIndex >= 0) {
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      library.setSelected(tracks.slice(start, end + 1).map((track) => track.id));
      return;
    }
  }

  if (intent.additive) {
    library.toggleSelected(intent.id);
  } else {
    library.select(intent.id);
  }

  selectionAnchorId.value = intent.id;
}

function openBulkEditor() {
  if (library.selectedTracks.length > 1) {
    isBulkEditorOpen.value = true;
  }
}

function setDisplayedViewMode(mode: ViewMode) {
  if (activeTab.value === 'tracks') {
    settings.setViewMode(mode);
    return;
  }

  facetViewMode.value = mode;
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
  <div class="library_view">
    <header class="library_view_header">
      <LibraryTitle />
      <LibraryToolbar
        :view-mode="displayedViewMode"
        :selected-count="library.selectedIds.length"
        @update:view-mode="setDisplayedViewMode"
        @edit-selected="openBulkEditor"
      />
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
        :class="{ library_view_panel_dropping: isDraggingOver }"
        role="tabpanel"
        :aria-labelledby="`library-tab-${activeTab}`"
      >
        <LibraryEmptyState
          v-if="library.hasNoMatches"
          :variant="library.missingInfoFilter === 'all' ? 'noMatches' : 'noMissingInfo'"
        />
        <PreviewGrid
          v-else-if="activeTab === 'tracks' && settings.viewMode === 'preview'"
          :tracks="library.visibleTracks"
          :selected-ids="library.selectedIds"
          :playing-id="player.currentTrack?.id ?? null"
          @select="selectFromTracks($event, library.visibleTracks)"
          @play="startPlayback($event)"
          @edit="library.openEditor($event.id)"
          @remove="askRemoval"
          @verify="library.verifyTrack($event)"
        />
        <LibraryTable
          v-else-if="activeTab === 'tracks'"
          :tracks="library.visibleTracks"
          :sort="library.sort"
          :selected-ids="library.selectedIds"
          :playing-id="player.currentTrack?.id ?? null"
          @sort="library.toggleSort($event)"
          @select="selectFromTracks($event, library.visibleTracks)"
          @play="startPlayback($event)"
          @edit="library.openEditor($event.id)"
          @remove="askRemoval"
          @verify="library.verifyTrack($event)"
        />
        <LibraryFacetList
          v-else-if="activeFacet !== null"
          :tracks="library.visibleTracks"
          :field="activeFacet"
          :view-mode="facetViewMode"
          :playing-track="player.currentTrack"
          @open="openFacet"
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
          <LibraryViewToggle v-if="selectedFacet?.field === 'album'" v-model="groupModalViewMode" />
        </div>

        <template v-if="selectedFacet?.field === 'artist'">
          <section
            class="library_view_group_modal_albums"
            :class="{ library_view_group_modal_albums_expanded: isArtistAlbumsExpanded }"
          >
            <div class="library_view_group_modal_albums_header">
              <h3>{{ t('library.groups.columns.albums') }}</h3>
              <AppButton
                class="library_view_group_modal_icon_button"
                variant="ghost"
                :aria-label="
                  t(
                    isArtistAlbumsExpanded
                      ? 'library.groups.collapseAlbums'
                      : 'library.groups.expandAlbums',
                  )
                "
                :title="
                  t(
                    isArtistAlbumsExpanded
                      ? 'library.groups.collapseAlbums'
                      : 'library.groups.expandAlbums',
                  )
                "
                @click="isArtistAlbumsExpanded = !isArtistAlbumsExpanded"
              >
                <AppIcon :name="isArtistAlbumsExpanded ? 'collapse' : 'expand'" />
              </AppButton>
            </div>

            <div class="library_view_group_modal_album_carousel" role="list">
              <button
                v-for="album in selectedFacetAlbums"
                :key="album.key"
                class="library_view_group_modal_album_card"
                type="button"
                :aria-label="t('library.groups.openLabel', { name: album.name })"
                @click="openFacet({ field: 'album', key: album.key, name: album.name })"
              >
                <CoverImage
                  v-if="album.coverTrack !== null"
                  class="library_view_group_modal_album_cover"
                  :track="album.coverTrack"
                  size="card"
                  eager
                />
                <span class="library_view_group_modal_album_title">{{ album.name }}</span>
                <span v-if="album.year !== null" class="library_view_group_modal_album_year">
                  {{ album.year }}
                </span>
              </button>
            </div>
          </section>

          <LibraryTable
            :tracks="selectedFacetTracks"
            :sort="library.sort"
            :selected-ids="library.selectedIds"
            :playing-id="player.currentTrack?.id ?? null"
            :hidden-column-keys="artistModalHiddenColumnKeys"
            :show-column-settings="false"
            @sort="library.toggleSort($event)"
            @select="selectFromTracks($event, selectedFacetTracks)"
            @play="startFacetPlayback($event)"
            @edit="openEditor"
            @remove="askRemoval"
            @verify="library.verifyTrack($event)"
          />
        </template>

        <template v-else-if="selectedFacet?.field === 'genre'">
          <div
            class="library_view_group_modal_tabs"
            role="tablist"
            :aria-label="t('library.groups.detailTabs')"
          >
            <button
              class="library_view_group_modal_tab"
              :class="{ library_view_group_modal_tab_active: genreModalTab === 'tracks' }"
              type="button"
              role="tab"
              :aria-selected="genreModalTab === 'tracks'"
              @click="genreModalTab = 'tracks'"
            >
              {{ t('library.tabs.tracks') }}
            </button>
            <button
              class="library_view_group_modal_tab"
              :class="{ library_view_group_modal_tab_active: genreModalTab === 'artists' }"
              type="button"
              role="tab"
              :aria-selected="genreModalTab === 'artists'"
              @click="genreModalTab = 'artists'"
            >
              {{ t('library.tabs.artists') }}
            </button>
            <button
              class="library_view_group_modal_tab"
              :class="{ library_view_group_modal_tab_active: genreModalTab === 'albums' }"
              type="button"
              role="tab"
              :aria-selected="genreModalTab === 'albums'"
              @click="genreModalTab = 'albums'"
            >
              {{ t('library.tabs.albums') }}
            </button>
          </div>

          <LibraryTable
            v-if="genreModalTab === 'tracks'"
            :tracks="selectedFacetTracks"
            :sort="library.sort"
            :selected-ids="library.selectedIds"
            :playing-id="player.currentTrack?.id ?? null"
            @sort="library.toggleSort($event)"
            @select="selectFromTracks($event, selectedFacetTracks)"
            @play="startFacetPlayback($event)"
            @edit="openEditor"
            @remove="askRemoval"
            @verify="library.verifyTrack($event)"
          />
          <LibraryFacetList
            v-else-if="genreModalTab === 'artists'"
            :tracks="selectedFacetTracks"
            field="artist"
            view-mode="preview"
            :playing-track="player.currentTrack"
            @open="openFacet"
          />
          <LibraryFacetList
            v-else
            :tracks="selectedFacetTracks"
            field="album"
            view-mode="preview"
            :playing-track="player.currentTrack"
            @open="openFacet"
          />
        </template>

        <template v-else>
          <PreviewGrid
            v-if="groupModalViewMode === 'preview'"
            :tracks="selectedFacetTracks"
            :selected-ids="library.selectedIds"
            :playing-id="player.currentTrack?.id ?? null"
            @select="selectFromTracks($event, selectedFacetTracks)"
            @play="startFacetPlayback($event)"
            @edit="openEditor"
            @remove="askRemoval"
            @verify="library.verifyTrack($event)"
          />
          <LibraryTable
            v-else
            :tracks="selectedFacetTracks"
            :sort="library.sort"
            :selected-ids="library.selectedIds"
            :playing-id="player.currentTrack?.id ?? null"
            @sort="library.toggleSort($event)"
            @select="selectFromTracks($event, selectedFacetTracks)"
            @play="startFacetPlayback($event)"
            @edit="openEditor"
            @remove="askRemoval"
            @verify="library.verifyTrack($event)"
          />
        </template>
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

    <BulkMetadataEditor
      v-if="isBulkEditorOpen"
      :tracks="library.selectedTracks"
      @close="isBulkEditorOpen = false"
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
    border: 2px dashed transparent;
    border-radius: $radius_lg;
    transition:
      background-color $duration_fast ease,
      border-color $duration_fast ease;

    &_dropping {
      border-color: var(--color_accent);
      background-color: var(--color_accent_soft);
    }
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

    &_albums {
      display: flex;
      flex-direction: column;
      gap: $space_sm;
      min-width: 0;
    }

    &_albums_header {
      display: flex;
      gap: $space_sm;
      align-items: center;
      justify-content: space-between;

      h3 {
        color: var(--color_text);
        font-size: 0.95em;
        font-weight: 700;
      }
    }

    &_icon_button {
      width: 2rem;
      height: 2rem;
      min-height: 2rem;
      padding: 0;
    }

    &_album_carousel {
      display: flex;
      gap: $space_md;
      min-width: 0;
      padding-bottom: $space_xs;
      overflow-x: auto;
      scroll-snap-type: x proximity;
    }

    &_album_card {
      display: flex;
      flex: 0 0 8.5rem;
      flex-direction: column;
      gap: $space_xs;
      padding: $space_sm;
      border: 1px solid var(--color_border);
      border-radius: $radius_md;
      background-color: var(--color_surface);
      color: var(--color_text);
      font: inherit;
      text-align: left;
      cursor: pointer;
      scroll-snap-align: start;
      transition:
        background-color $duration_fast ease,
        border-color $duration_fast ease;

      &:hover {
        background-color: var(--color_surface_hover);
      }

      @include focus_ring;
    }

    &_albums_expanded &_album_card {
      flex-basis: 12rem;
    }

    &_album_cover {
      width: 100%;
      flex-shrink: 0;
    }

    &_album_title,
    &_album_year {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &_album_title {
      font-size: 0.875em;
      font-weight: 700;
    }

    &_album_year {
      color: var(--color_text_muted);
      font-size: 0.8em;
      font-variant-numeric: tabular-nums;
    }

    &_tabs {
      display: inline-flex;
      align-self: flex-start;
      padding: $space_xs;
      border: 1px solid var(--color_border);
      border-radius: $radius_md;
      background-color: var(--color_surface_alt);
    }

    &_tab {
      min-width: 5.5rem;
      padding: $space_xs $space_md;
      border: 0;
      border-radius: $radius_sm;
      background: transparent;
      color: var(--color_text_muted);
      font: inherit;
      cursor: pointer;

      &:hover {
        color: var(--color_text);
      }

      @include focus_ring;

      &_active {
        background-color: var(--color_surface);
        color: var(--color_text);
        box-shadow: var(--shadow_subtle);
      }
    }
  }
}

@media (max-width: 640px) {
  .library_view_group_modal {
    &_album_card {
      flex-basis: 7.5rem;
    }

    &_albums_expanded &_album_card {
      flex-basis: 10rem;
    }

    &_tabs {
      width: 100%;
    }

    &_tab {
      min-width: 0;
      flex: 1;
    }
  }
}
</style>
