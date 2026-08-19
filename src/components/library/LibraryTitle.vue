<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import AppMenu from '@/components/common/AppMenu.vue';
import LibraryDeleteDialog from '@/components/library/LibraryDeleteDialog.vue';
import LibraryTrackListExportDialog from '@/components/library/LibraryTrackListExportDialog.vue';
import { useLibraryStore } from '@/stores/library';
import type { LibrarySummary } from '@/types/library';
import type { MenuItem } from '@/types/menu';

const { t } = useI18n();
const library = useLibraryStore();

const isEditing = ref(false);
const draft = ref('');
const field = ref<HTMLInputElement | null>(null);

const displayName = computed(() => library.libraryName || t('library.title'));

const pendingDeletion = ref<LibrarySummary | null>(null);
const isTrackListExportOpen = ref(false);

/** The libraries to switch between, then the actions on the open one. */
const menuItems = computed<MenuItem[]>(() => [
  ...library.libraries.map((entry) => ({
    id: `open:${entry.id}`,
    label: entry.name,
    checked: entry.active,
    description: t('library.catalog.open', { name: entry.name }),
  })),
  { id: 'rename', label: t('library.name.menu.rename'), icon: 'edit', divider: true },
  {
    id: 'verifyAll',
    label: t('library.name.menu.verifyAll'),
    icon: 'verify',
    disabled: library.tracks.length === 0 || library.isVerifying,
  },
  {
    id: 'exportList',
    label: t('library.name.menu.exportList'),
    icon: 'list',
    disabled: library.tracks.length === 0,
  },
  { id: 'import', label: t('library.name.menu.import'), icon: 'import' },
  { id: 'export', label: t('library.name.menu.export'), icon: 'export' },
  {
    id: 'delete',
    label: t('library.name.menu.delete'),
    icon: 'remove',
    danger: true,
    disabled: !library.canDeleteLibrary,
  },
]);

onMounted(() => {
  void library.loadLibraries();
});

function run(id: string) {
  const opened = id.startsWith('open:') ? id.slice('open:'.length) : null;

  if (opened !== null) {
    void library.switchLibrary(opened);
    return;
  }

  if (id === 'rename') {
    void startEditing();
    return;
  }

  if (id === 'export' && library.activeLibraryId !== null) {
    void library.exportLibrary(library.activeLibraryId);
    return;
  }

  if (id === 'exportList') {
    isTrackListExportOpen.value = true;
    return;
  }

  if (id === 'verifyAll') {
    void library.verifyAllTracks();
    return;
  }

  if (id === 'import') {
    void library.importLibrary('mergeSkipDuplicates');
    return;
  }

  if (id === 'delete') {
    pendingDeletion.value =
      library.libraries.find((entry) => entry.id === library.activeLibraryId) ?? null;
  }
}

async function confirmDeletion(id: string) {
  pendingDeletion.value = null;
  await library.deleteLibrary(id);
}

async function startEditing() {
  draft.value = library.libraryName;
  isEditing.value = true;
  await nextTick();
  field.value?.select();
}

function cancel() {
  isEditing.value = false;
}

/** Keeps the field open when the name is refused, so the text is not lost. */
async function submit() {
  if (await library.renameLibrary(draft.value)) {
    isEditing.value = false;
  }
}
</script>

<template>
  <div class="library_title">
    <form v-if="isEditing" class="library_title_form" @submit.prevent="submit">
      <input
        ref="field"
        v-model="draft"
        class="library_title_field"
        type="text"
        :aria-label="t('library.name.field')"
        :placeholder="t('library.name.placeholder')"
        :disabled="library.isRenaming"
        data-testid="library-name-field"
        @keydown.esc="cancel"
      />
      <button
        class="library_title_action"
        type="submit"
        :aria-label="t('library.name.save')"
        :disabled="library.isRenaming"
        data-testid="library-name-save"
      >
        <AppIcon name="check" />
      </button>
      <button
        class="library_title_action"
        type="button"
        :aria-label="t('library.name.cancel')"
        data-testid="library-name-cancel"
        @click="cancel"
      >
        <AppIcon name="close" />
      </button>
    </form>

    <!-- Renaming starts from the menu: no separate pen next to the name. -->
    <h1 v-else class="library_title_name">{{ displayName }}</h1>

    <AppMenu :items="menuItems" :label="t('library.name.actions')" @select="run" />

    <LibraryDeleteDialog
      :library="pendingDeletion"
      @confirm="confirmDeletion"
      @cancel="pendingDeletion = null"
    />

    <LibraryTrackListExportDialog
      :open="isTrackListExportOpen"
      @close="isTrackListExportOpen = false"
    />
  </div>
</template>

<style scoped lang="scss">
.library_title {
  display: flex;
  gap: $space_sm;
  align-items: center;
  min-width: 0;

  &_name {
    overflow: hidden;
    font-size: 1.75em;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_form {
    display: flex;
    gap: $space_sm;
    align-items: center;
    min-width: 0;
  }

  &_field {
    min-width: 0;
    min-height: 2.25rem;
    padding: $space_xs $space_sm;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_md;
    background-color: var(--color_surface);
    color: var(--color_text);
    font: inherit;
    font-size: 1.5em;
    font-weight: 600;

    @include focus_ring;

    &:disabled {
      opacity: 0.6;
    }
  }

  &_action {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 0;
    border-radius: $radius_md;
    background-color: transparent;
    color: var(--color_text_muted);
    font: inherit;
    cursor: pointer;
    transition:
      background-color $duration_fast ease,
      color $duration_fast ease;

    &:hover:not(:disabled) {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @include focus_ring;
  }
}
</style>
