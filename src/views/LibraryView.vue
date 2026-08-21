<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/AppModal.vue';
import DefaultPlayerBanner from '@/components/library/DefaultPlayerBanner.vue';
import LibraryContentTabs from '@/components/library/LibraryContentTabs.vue';
import LibraryEmptyState from '@/components/library/LibraryEmptyState.vue';
import LibraryAlbumSummary from '@/components/library/LibraryAlbumSummary.vue';
import LibraryFacetList, {
  type FacetGroupOpenPayload,
} from '@/components/library/LibraryFacetList.vue';
import LibraryGroupCarousel, {
  type CarouselGroup,
} from '@/components/library/LibraryGroupCarousel.vue';
import LibraryViewToggle from '@/components/library/LibraryViewToggle.vue';
import LibraryImportReport from '@/components/library/LibraryImportReport.vue';
import LibraryTable from '@/components/library/LibraryTable.vue';
import LibraryTabs from '@/components/library/LibraryTabs.vue';
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

/** The three ways the library groups the same tracks. */
type FacetField = 'artist' | 'album' | 'genre';

const { t } = useI18n();
const library = useLibraryStore();
const settings = useSettingsStore();
const player = usePlayerStore();
const pendingRemoval = ref<TrackView | null>(null);
const selectedFacet = ref<FacetGroupOpenPayload | null>(null);
const facetModalHistory = ref<FacetModalState[]>([]);
const activeTab = ref<LibraryContentTab>('tracks');
const groupModalViewMode = ref<ViewMode>('preview');
const facetViewModes = ref<Record<FacetField, ViewMode>>({
  artist: 'preview',
  album: 'preview',
  genre: 'preview',
});
/** What the genre modal lists under its carousels. */
const genreModalList = ref<GenreModalList>('tracks');
const selectionAnchorId = ref<string | null>(null);
const isBulkEditorOpen = ref(false);
// The modal tables are read, not configured: each lists a fixed set of columns, without the
// field the modal is already about.
const artistModalColumnKeys = [
  'cover',
  'title',
  'album',
  'year',
  'duration',
] as const satisfies readonly TableColumnKey[];
const albumModalColumnKeys = [
  'cover',
  'title',
  'year',
  'duration',
] as const satisfies readonly TableColumnKey[];
const genreModalColumnKeys = [
  'cover',
  'title',
  'artist',
  'album',
  'year',
  'duration',
] as const satisfies readonly TableColumnKey[];

type GenreModalList = 'tracks' | 'artists' | 'albums';

interface FacetModalState {
  group: FacetGroupOpenPayload;
  viewMode: ViewMode;
  genreList: GenreModalList;
}

const activeFacet = computed<FacetField | null>(() => {
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

const selectedAlbumGenres = computed(() => {
  if (selectedFacet.value?.field !== 'album') {
    return [];
  }

  const genres = [
    ...new Set(
      selectedFacetTracks.value
        .map((track) => track.genre?.trim() ?? '')
        .filter((genre) => genre.length > 0),
    ),
  ].sort((left, right) => left.localeCompare(right));

  return genres.length > 0 ? genres : [t('library.groups.unknown.genre')];
});

const selectedAlbumCoverTrack = computed<TrackView | null>(() => {
  if (selectedFacet.value?.field !== 'album') {
    return null;
  }

  return (
    selectedFacetTracks.value.find((track) => track.hasCover && !track.missing) ??
    selectedFacetTracks.value[0] ??
    null
  );
});

const selectedAlbumYear = computed<number | null>(() => {
  if (selectedFacet.value?.field !== 'album') {
    return null;
  }

  return selectedFacetTracks.value.find((track) => track.year !== null)?.year ?? null;
});

const selectedAlbumArtistLinks = computed<FacetGroupOpenPayload[]>(() => {
  if (selectedFacet.value?.field !== 'album') {
    return [];
  }

  return [...new Set(selectedFacetTracks.value.map((track) => facetKeyOf(track, 'artist')))]
    .sort((left, right) => facetNameOf('artist', left).localeCompare(facetNameOf('artist', right)))
    .map((key) => ({
      field: 'artist',
      key,
      name: facetNameOf('artist', key),
    }));
});

interface ModalAlbumGroup {
  key: string;
  name: string;
  year: number | null;
  tracks: TrackView[];
  coverTrack: TrackView | null;
  playing: boolean;
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
        playing:
          player.currentTrack !== null &&
          tracks.some((track) => track.id === player.currentTrack?.id),
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

const albumCarouselGroups = computed<CarouselGroup[]>(() =>
  selectedFacetAlbums.value.map((album) => ({
    key: album.key,
    name: album.name,
    meta: album.year === null ? null : String(album.year),
    coverTrack: album.coverTrack,
    playing: album.playing,
  })),
);

const genreModalTabs = computed(() =>
  (['tracks', 'artists', 'albums'] as const satisfies readonly GenreModalList[]).map((tab) => ({
    id: tab,
    label: t(`library.tabs.${tab}`),
  })),
);

const activeFacetViewMode = computed(() =>
  activeFacet.value === null ? 'preview' : facetViewModes.value[activeFacet.value],
);

const displayedViewMode = computed(() =>
  activeTab.value === 'tracks' ? settings.viewMode : activeFacetViewMode.value,
);

const { isDraggingOver } = useFileDrop((paths) => {
  library.addPaths(paths);
});

onMounted(async () => {
  await library.loadHomeLibrary(settings.mainLibraryId);
});

watch(
  () => settings.mainLibraryId,
  async (mainLibraryId) => {
    if (settings.isReady && mainLibraryId !== null) {
      await library.loadHomeLibrary(mainLibraryId);
    }
  },
);

/** The visible list becomes the queue, so previous and next follow what is on screen. */
async function startPlayback(track: TrackView) {
  await player.playFrom(library.visibleTracks, track.id);
}

async function startFacetPlayback(track: TrackView) {
  await player.playFrom(selectedFacetTracks.value, track.id);
}

function facetKeyOf(track: TrackView, field: FacetField) {
  const value = track[field]?.trim() ?? '';
  return value.length > 0 ? value : '__unknown__';
}

function facetNameOf(field: FacetField, key: string) {
  return key === '__unknown__' ? t(`library.groups.unknown.${field}`) : key;
}

function askRemoval(track: TrackView) {
  closeFacetModal();
  pendingRemoval.value = track;
}

function openEditor(track: TrackView) {
  closeFacetModal();
  library.openEditor(track.id);
}

function currentFacetModalState(): FacetModalState | null {
  if (selectedFacet.value === null) {
    return null;
  }

  return {
    group: { ...selectedFacet.value },
    viewMode: groupModalViewMode.value,
    genreList: genreModalList.value,
  };
}

function applyFacetModalDefaults(group: FacetGroupOpenPayload) {
  groupModalViewMode.value = group.field === 'album' ? 'table' : facetViewModes.value[group.field];
  genreModalList.value = 'tracks';
}

function openFacet(group: FacetGroupOpenPayload) {
  const currentState = currentFacetModalState();

  if (currentState === null) {
    facetModalHistory.value = [];
  } else {
    facetModalHistory.value = [...facetModalHistory.value, currentState];
  }

  applyFacetModalDefaults(group);
  selectedFacet.value = group;
}

function openAlbumFromCarousel(key: string) {
  openFacet({ field: 'album', key, name: facetNameOf('album', key) });
}

function openArtistFromCarousel(key: string) {
  openFacet({ field: 'artist', key, name: facetNameOf('artist', key) });
}

function goBackInFacetModal() {
  const previous = facetModalHistory.value.at(-1);

  if (previous === undefined) {
    return;
  }

  facetModalHistory.value = facetModalHistory.value.slice(0, -1);
  selectedFacet.value = previous.group;
  groupModalViewMode.value = previous.viewMode;
  genreModalList.value = previous.genreList;
}

function closeFacetModal() {
  selectedFacet.value = null;
  facetModalHistory.value = [];
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

  if (activeFacet.value !== null) {
    facetViewModes.value = { ...facetViewModes.value, [activeFacet.value]: mode };
  }
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

    <output v-if="library.lastExport !== null" class="library_view_notice">
      {{ t('library.catalog.exported', { path: library.lastExport }) }}
      <AppButton variant="ghost" @click="library.dismissExport()">
        {{ t('library.report.dismiss') }}
      </AppButton>
    </output>

    <output v-if="library.lastLibraryImport !== null" class="library_view_notice">
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
    </output>

    <output v-if="library.lastVerification !== null" class="library_view_notice">
      {{
        t('library.verification.summary', {
          total: library.lastVerification.total,
          missing: library.lastVerification.missing,
        })
      }}
      <AppButton variant="ghost" @click="library.dismissVerification()">
        {{ t('library.report.dismiss') }}
      </AppButton>
    </output>

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
          allow-horizontal-scroll
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
          :view-mode="activeFacetViewMode"
          :playing-track="player.currentTrack"
          @open="openFacet"
        />
      </section>
    </template>

    <AppModal
      :open="selectedFacet !== null"
      :title="t('library.groups.modalTitle', { name: selectedFacet?.name ?? '' })"
      wide
      @close="closeFacetModal"
    >
      <div class="library_view_group_modal">
        <div class="library_view_group_modal_header">
          <AppButton
            v-if="facetModalHistory.length > 0"
            class="library_view_group_modal_back_button"
            variant="ghost"
            :aria-label="t('library.groups.back')"
            :title="t('library.groups.back')"
            @click="goBackInFacetModal"
          >
            <AppIcon name="back" />
          </AppButton>
          <LibraryAlbumSummary
            v-if="selectedFacet?.field === 'album'"
            :name="selectedFacet.name"
            :cover-track="selectedAlbumCoverTrack"
            :year="selectedAlbumYear"
            :artists="selectedAlbumArtistLinks"
            :genres="selectedAlbumGenres"
            :track-count="selectedFacetTracks.length"
            @open-artist="openArtistFromCarousel"
          />
          <div v-else class="library_view_group_modal_summary">
            <p>
              {{
                t(
                  'library.groups.trackCount',
                  { count: selectedFacetTracks.length },
                  selectedFacetTracks.length,
                )
              }}
            </p>
          </div>
          <LibraryViewToggle v-if="selectedFacet?.field === 'album'" v-model="groupModalViewMode" />
        </div>

        <template v-if="selectedFacet?.field === 'artist'">
          <LibraryGroupCarousel
            :title="t('library.groups.columns.albums')"
            :groups="albumCarouselGroups"
            data-testid="artist-albums-carousel"
            @open="openAlbumFromCarousel"
          />

          <LibraryTable
            :tracks="selectedFacetTracks"
            :sort="library.sort"
            :selected-ids="library.selectedIds"
            :playing-id="player.currentTrack?.id ?? null"
            :column-keys="artistModalColumnKeys"
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
          <LibraryTabs
            v-model="genreModalList"
            :tabs="genreModalTabs"
            :label="t('library.groups.detailTabs')"
            id-base="genre-detail"
          />

          <div
            :id="`genre-detail-panel-${genreModalList}`"
            class="library_view_group_modal_panel"
            role="tabpanel"
            :aria-labelledby="`genre-detail-tab-${genreModalList}`"
          >
            <LibraryTable
              v-if="genreModalList === 'tracks'"
              :tracks="selectedFacetTracks"
              :sort="library.sort"
              :selected-ids="library.selectedIds"
              :playing-id="player.currentTrack?.id ?? null"
              :column-keys="genreModalColumnKeys"
              :show-column-settings="false"
              @sort="library.toggleSort($event)"
              @select="selectFromTracks($event, selectedFacetTracks)"
              @play="startFacetPlayback($event)"
              @edit="openEditor"
              @remove="askRemoval"
              @verify="library.verifyTrack($event)"
            />
            <!-- Artists and albums are browsed by their covers, tracks by their columns. -->
            <LibraryFacetList
              v-else
              :tracks="selectedFacetTracks"
              :field="genreModalList === 'artists' ? 'artist' : 'album'"
              view-mode="preview"
              :playing-track="player.currentTrack"
              @open="openFacet"
            />
          </div>
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
            :column-keys="albumModalColumnKeys"
            :show-column-settings="false"
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
        <AppButton @click="closeFacetModal">{{ t('library.groups.close') }}</AppButton>
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

    // The album header is a block of its own height: the back button and the view switch
    // stay on its first line instead of floating in the middle of it.
    &_header {
      display: flex;
      gap: $space_md;
      align-items: flex-start;
      justify-content: space-between;
      color: var(--color_text_muted);
      font-size: 0.875em;
    }

    &_panel {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }

    &_back_button {
      width: 2rem;
      height: 2rem;
      min-height: 2rem;
      flex: 0 0 auto;
      padding: 0;
    }

    &_summary {
      display: flex;
      flex: 1;
      flex-wrap: wrap;
      gap: $space_xs $space_md;
      min-width: 0;

      p {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}
</style>
