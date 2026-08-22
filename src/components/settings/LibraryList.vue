<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import LibraryDeleteDialog from '@/components/library/LibraryDeleteDialog.vue';
import LibraryNameForm from '@/components/settings/LibraryNameForm.vue';
import { useLibraryStore } from '@/stores/library';
import { useSettingsStore } from '@/stores/settings';
import type { LibrarySummary } from '@/types/library';

const { t } = useI18n();
const library = useLibraryStore();
const settings = useSettingsStore();

const selectedId = ref<string | null>(null);
const isRenaming = ref(false);
const pendingDeletion = ref<LibrarySummary | null>(null);

/** The commands above the list read the library picked in it, and wait until there is one. */
const selected = computed<LibrarySummary | null>(
  () => library.libraries.find((entry) => entry.id === selectedId.value) ?? null,
);

onMounted(async () => {
  await library.loadLibraries();
});

function select(entry: LibrarySummary) {
  selectedId.value = entry.id;
  isRenaming.value = false;
}

async function confirmDeletion(id: string) {
  pendingDeletion.value = null;

  if (await library.deleteLibrary(id)) {
    if (selectedId.value === id) {
      selectedId.value = null;
      isRenaming.value = false;
    }

    if (settings.mainLibraryId === id) {
      await settings.setMainLibraryId(library.activeLibraryId);
    }
  }
}

/** The backend renames the open library, so the chosen one is opened first. */
async function open(entry: LibrarySummary): Promise<boolean> {
  return entry.active || (await library.switchLibrary(entry.id));
}

async function setMainLibrary() {
  const entry = selected.value;

  if (entry === null || !(await open(entry))) {
    return;
  }

  await settings.setMainLibraryId(entry.id);
}

async function exportSelected() {
  const entry = selected.value;

  if (entry !== null) {
    await library.exportLibrary(entry.id);
  }
}

async function startRename() {
  const entry = selected.value;

  if (entry !== null && (await open(entry))) {
    isRenaming.value = true;
  }
}
</script>

<template>
  <div class="library_list">
    <div class="library_list_commands">
      <AppButton :disabled="selected === null" data-testid="export-library" @click="exportSelected">
        <AppIcon name="export" />
        {{ t('library.catalog.exportShort') }}
      </AppButton>
      <AppButton :disabled="selected === null" data-testid="rename-library" @click="startRename">
        <AppIcon name="edit" />
        {{ t('library.name.menu.rename') }}
      </AppButton>
      <AppButton
        :disabled="selected === null || selected.id === settings.mainLibraryId"
        data-testid="set-main-library"
        @click="setMainLibrary"
      >
        <AppIcon v-if="selected !== null && selected.id === settings.mainLibraryId" name="check" />
        {{ t('library.catalog.primaryShort') }}
      </AppButton>
    </div>

    <div v-if="isRenaming" class="library_list_rename" data-testid="library-rename">
      <LibraryNameForm />
      <AppButton variant="ghost" data-testid="rename-close" @click="isRenaming = false">
        {{ t('library.name.cancel') }}
      </AppButton>
    </div>

    <ul class="library_list_items">
      <li
        v-for="entry in library.libraries"
        :key="entry.id"
        class="library_list_item"
        :class="{ library_list_item_active: entry.active }"
        :data-library="entry.id"
      >
        <button
          class="library_list_item_select"
          type="button"
          :aria-pressed="selectedId === entry.id"
          data-testid="select-library"
          @click="select(entry)"
        >
          <span class="library_list_item_name">{{ entry.name }}</span>
          <span class="library_list_item_meta">
            {{ t('library.catalog.trackCount', entry.trackCount) }}
            <template v-if="entry.active"> · {{ t('library.catalog.active') }}</template>
            <template v-if="entry.id === settings.mainLibraryId">
              · {{ t('library.catalog.primary') }}
            </template>
          </span>
        </button>

        <div class="library_list_item_actions">
          <AppButton
            v-if="!entry.active"
            :aria-label="t('library.catalog.open', { name: entry.name })"
            data-testid="open-library"
            @click="library.switchLibrary(entry.id)"
          >
            {{ t('library.catalog.openShort') }}
          </AppButton>
          <AppButton
            variant="danger"
            :aria-label="t('library.catalog.remove', { name: entry.name })"
            :disabled="!library.canDeleteLibraryId(entry.id)"
            data-testid="delete-library"
            @click="pendingDeletion = entry"
          >
            <AppIcon name="remove" />
          </AppButton>
        </div>
      </li>
    </ul>

    <output v-if="library.lastExport !== null" class="library_list_notice">
      {{ t('library.catalog.exported', { path: library.lastExport }) }}
      <AppButton variant="ghost" @click="library.dismissExport()">
        {{ t('library.report.dismiss') }}
      </AppButton>
    </output>

    <LibraryDeleteDialog
      :library="pendingDeletion"
      @confirm="confirmDeletion"
      @cancel="pendingDeletion = null"
    />
  </div>
</template>

<style scoped lang="scss">
.library_list {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_commands {
    display: flex;
    flex-wrap: wrap;
    gap: $space_sm;
  }

  // The name and what is done to it are two things: they are given room to be two.
  &_rename {
    display: flex;
    flex-wrap: wrap;
    gap: $space_md;
    align-items: flex-end;
    padding: $space_md;
    @include surface_panel($radius_md, var(--color_surface_alt));
  }

  &_items {
    display: flex;
    flex-direction: column;
    gap: $space_sm;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &_item {
    display: flex;
    gap: $space_md;
    align-items: center;
    justify-content: space-between;
    padding: $space_sm $space_md;
    @include surface_panel;

    &_active {
      border-color: var(--color_accent);
    }

    &:has(.library_list_item_select[aria-pressed='true']) {
      border-color: var(--color_accent);
      background-color: var(--row_selected_background);
    }

    // The whole entry picks the library the commands above act on.
    &_select {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: flex-start;
      min-width: 0;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;

      @include focus_ring;
    }

    &_name {
      overflow: hidden;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &_meta {
      color: var(--color_text_muted);
      font-size: 0.875em;
    }

    &_actions {
      display: flex;
      flex-shrink: 0;
      gap: $space_xs;
      align-items: center;
    }
  }

  &_notice {
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
    padding: $space_sm $space_md;
    @include surface_panel($radius_md, var(--color_surface_alt));
    font-size: 0.875em;
    overflow-wrap: anywhere;
  }
}
</style>
