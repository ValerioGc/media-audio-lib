<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/AppModal.vue';
import DefaultPlayerBanner from '@/components/library/DefaultPlayerBanner.vue';
import LibraryContentTabs from '@/components/library/LibraryContentTabs.vue';
import LibraryCounts from '@/components/library/LibraryCounts.vue';
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
import type { PreviewCardMeta } from '@/components/library/PreviewCard.vue';
import PreviewGrid from '@/components/library/PreviewGrid.vue';
import BulkMetadataEditor from '@/components/metadata/BulkMetadataEditor.vue';
import MetadataEditor from '@/components/metadata/MetadataEditor.vue';
import { useFileDrop } from '@/composables/useFileDrop';
import {
  DEFAULT_FACET_SORT,
  facetSortColumns,
  type FacetField,
  type FacetSort,
} from '@/services/facet-columns';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { LibraryContentTab, TrackSelectionIntent, TrackView } from '@/types/library';
import type { PreviewSizePage, TableColumnKey, ViewMode } from '@/types/settings';

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
// The album modal names its year and its artists in the header: the list underneath repeats
// neither, in table or in preview.
const albumModalColumnKeys = [
  'cover',
  'title',
  'duration',
] as const satisfies readonly TableColumnKey[];
const albumModalPreviewMetaKeys = [] as const satisfies readonly PreviewCardMeta[];
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

const selectedAlbumGenreLinks = computed<FacetGroupOpenPayload[]>(() => {
  if (selectedFacet.value?.field !== 'album') {
    return [];
  }

  return [...new Set(selectedFacetTracks.value.map((track) => facetKeyOf(track, 'genre')))]
    .sort((left, right) => facetNameOf('genre', left).localeCompare(facetNameOf('genre', right)))
    .map((key) => ({
      field: 'genre',
      key,
      name: facetNameOf('genre', key),
    }));
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

/**
 * How the list of groups on the open tab is ordered.
 *
 * Held here because the control that changes it is in the toolbar, at the top of the page,
 * while the list it orders is in the panel below: neither can reach the other.
 */
const facetSort = ref<FacetSort>({ ...DEFAULT_FACET_SORT });

// Each tab has columns of its own: an order left over from the previous one would have
// nothing to read.
watch(activeFacet, () => {
  facetSort.value = { ...DEFAULT_FACET_SORT };
});

const facetSortOptions = computed(() =>
  activeFacet.value === null
    ? []
    : facetSortColumns(activeFacet.value).map((column) => ({
        value: column.key,
        label: t(column.labelKey),
      })),
);

function sortFacets(column: string) {
  const wanted = column as FacetSort['column'];

  facetSort.value =
    facetSort.value.column === wanted
      ? { column: wanted, direction: facetSort.value.direction === 'asc' ? 'desc' : 'asc' }
      : { column: wanted, direction: 'asc' };
}

/**
 * Whether the toolbar shows a way to order what is below it.
 *
 * Only the preview needs one — a table is ordered from its own headings — and a list of
 * genres is a handful of names read in one go, which is left alone.
 */
const showsSortControl = computed(
  () => displayedViewMode.value === 'preview' && activeTab.value !== 'genres',
);

/** The page whose card size the toolbar is asking about, when cards are on screen. */
const previewSizePage = computed<PreviewSizePage | undefined>(() =>
  displayedViewMode.value === 'preview' ? activeTab.value : undefined,
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
/** The file is read again first: what plays is what is on the disk right now. */
async function startPlayback(track: TrackView) {
  await library.refreshTrack(track.id);
  await player.playFrom(library.visibleTracks, track.id);
}

async function startFacetPlayback(track: TrackView) {
  await library.refreshTrack(track.id);
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

function openGenreFromSummary(key: string) {
  openFacet({ field: 'genre', key, name: facetNameOf('genre', key) });
}

const previousFacet = computed(() => facetModalHistory.value.at(-1)?.group ?? null);

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
  <!-- Files can be dropped anywhere on the library, so the outline is the view itself: an
       empty library is exactly where the first drop lands. -->
  <div class="library_view" :class="{ library_view_dropping: isDraggingOver }">
    <header class="library_view_header">
      <LibraryTitle />
      <LibraryToolbar
        :view-mode="displayedViewMode"
        :selected-count="library.selectedIds.length"
        :show-sort="showsSortControl"
        :preview-size-page="previewSizePage"
        :sort="activeFacet === null ? undefined : facetSort"
        :sort-options="activeFacet === null ? undefined : facetSortOptions"
        @update:view-mode="setDisplayedViewMode"
        @sort="sortFacets"
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

    <!-- What the refresh found on opening: files gone from disk are an error, tags read
         again are a note that closes itself. -->
    <p
      v-if="library.hasMissingAfterRefresh"
      class="library_view_error"
      role="alert"
      data-testid="refresh-missing"
    >
      <AppIcon name="warning" />
      {{
        t(
          'library.refresh.missing',
          { count: library.lastRefresh?.missing.length ?? 0 },
          library.lastRefresh?.missing.length ?? 0,
        )
      }}
      <AppButton variant="ghost" @click="library.dismissRefresh()">
        {{ t('library.report.dismiss') }}
      </AppButton>
    </p>

    <output
      v-else-if="(library.lastRefresh?.refreshed ?? 0) > 0"
      class="library_view_notice"
      data-testid="refresh-updated"
    >
      {{
        t(
          'library.refresh.refreshed',
          { count: library.lastRefresh?.refreshed ?? 0 },
          library.lastRefresh?.refreshed ?? 0,
        )
      }}
      <AppButton variant="ghost" @click="library.dismissRefresh()">
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
      <!-- The tabs name what is on screen, the counts say how much of it there is. -->
      <div class="library_view_tabs">
        <LibraryContentTabs v-model="activeTab" />
        <LibraryCounts :tab="activeTab" />
      </div>

      <section
        :id="`library-panel-${activeTab}`"
        class="library_view_panel"
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
        />
        <LibraryFacetList
          v-else-if="activeFacet !== null"
          :tracks="library.visibleTracks"
          :field="activeFacet"
          :view-mode="activeFacetViewMode"
          v-model:sort="facetSort"
          :playing-track="player.currentTrack"
          @open="openFacet"
        />
      </section>
    </template>

    <AppModal
      :open="selectedFacet !== null"
      :title="t('library.groups.modalTitle', { name: selectedFacet?.name ?? '' })"
      wide
      glass
      @close="closeFacetModal"
    >
      <div class="library_view_group_modal">
        <!-- The way back names the group it returns to: three levels down, an arrow alone
             says nothing about where it lands. -->
        <button
          v-if="previousFacet !== null"
          class="library_view_group_modal_back"
          type="button"
          :aria-label="t('library.groups.backTo', { name: previousFacet.name })"
          data-testid="facet-modal-back"
          @click="goBackInFacetModal"
        >
          <AppIcon name="back" />
          <span class="library_view_group_modal_back_label">
            {{ t('library.groups.backTo', { name: previousFacet.name }) }}
          </span>
        </button>

        <div class="library_view_group_modal_header">
          <LibraryAlbumSummary
            v-if="selectedFacet?.field === 'album'"
            :name="selectedFacet.name"
            :cover-track="selectedAlbumCoverTrack"
            :year="selectedAlbumYear"
            :artists="selectedAlbumArtistLinks"
            :genres="selectedAlbumGenreLinks"
            :track-count="selectedFacetTracks.length"
            @open-artist="openArtistFromCarousel"
            @open-genre="openGenreFromSummary"
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
            :meta-keys="albumModalPreviewMetaKeys"
            @select="selectFromTracks($event, selectedFacetTracks)"
            @play="startFacetPlayback($event)"
            @edit="openEditor"
            @remove="askRemoval"
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
  transition:
    background-color $duration_fast ease,
    border-color $duration_fast ease;

  // Files land anywhere on the library, so the whole view lights up: the panel alone left an
  // empty library, the very case where the first drop happens, without a target.
  &_dropping {
    border-color: var(--color_accent);
    background-color: var(--color_accent_soft);
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
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
    padding: $space_sm $space_md;
    color: var(--color_text);

    @include surface_panel($radius_md, var(--color_surface_alt));

    border-color: var(--color_border_strong);
  }

  // A little air above the line, so the counts do not touch the toolbar over them.
  // The line under the tabs belongs to the row, not to the strip of tabs: the counts sit on
  // the same line, and a rail that stopped where the tabs stop left it cut short of them.
  &_tabs {
    display: flex;
    flex-wrap: wrap;
    gap: $space_sm $space_md;
    align-items: stretch;
    justify-content: space-between;
    padding-top: $space_xs;
    border-bottom: 1px solid var(--color_border);

    // The strip keeps the indicator that runs along the bottom of it, and gives up the rail
    // it used to draw for itself.
    :deep(.library_tabs::after) {
      display: none;
    }
  }

  &_panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  &_group_modal {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $space_md;
    // It fills the dialog and shrinks with it: the list inside is what scrolls, whatever
    // the pointer is doing — a wheel, a gesture, or the scrollbar itself.
    min-height: 0;

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

    &_back {
      display: inline-flex;
      gap: $space_xs;
      align-self: flex-start;
      align-items: center;
      max-width: 100%;
      min-height: 2rem;
      padding: $space_2xs $space_sm $space_2xs $space_xs;
      border: 1px solid var(--color_border);
      border-radius: 999px;
      background-color: var(--color_surface_alt);
      color: var(--color_text);
      font: inherit;
      font-size: 0.875em;
      cursor: pointer;
      transition:
        background-color $duration_fast ease,
        border-color $duration_fast ease;

      &:hover {
        border-color: var(--color_accent);
        background-color: var(--row_hover_background);
      }

      @include focus_ring;

      &_label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
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
