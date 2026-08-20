<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppInput from '@/components/common/AppInput.vue';
import LibraryDeleteDialog from '@/components/library/LibraryDeleteDialog.vue';
import { useLibraryStore } from '@/stores/library';
import { useSettingsStore } from '@/stores/settings';
import type { LibrarySummary } from '@/types/library';

const { t } = useI18n();
const library = useLibraryStore();
const settings = useSettingsStore();

const newName = ref('');
const pendingDeletion = ref<LibrarySummary | null>(null);

onMounted(async () => {
  await library.loadLibraries();
});

async function create() {
  if (await library.createLibrary(newName.value)) {
    newName.value = '';
  }
}

async function confirmDeletion(id: string) {
  pendingDeletion.value = null;

  if (await library.deleteLibrary(id)) {
    if (settings.mainLibraryId === id) {
      await settings.setMainLibraryId(library.activeLibraryId);
    }
  }
}

async function setMainLibrary(entry: LibrarySummary) {
  if (!entry.active && !(await library.switchLibrary(entry.id))) {
    return;
  }

  await settings.setMainLibraryId(entry.id);
}
</script>

<template>
  <div class="library_list">
    <ul class="library_list_items">
      <li
        v-for="entry in library.libraries"
        :key="entry.id"
        class="library_list_item"
        :class="{ library_list_item_active: entry.active }"
        :data-library="entry.id"
      >
        <div class="library_list_item_info">
          <span class="library_list_item_name">{{ entry.name }}</span>
          <span class="library_list_item_meta">
            {{ t('library.catalog.trackCount', entry.trackCount) }}
            <template v-if="entry.active"> · {{ t('library.catalog.active') }}</template>
            <template v-if="entry.id === settings.mainLibraryId">
              · {{ t('library.catalog.primary') }}
            </template>
          </span>
        </div>

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
            :disabled="entry.id === settings.mainLibraryId"
            :aria-label="t('library.catalog.setPrimary', { name: entry.name })"
            data-testid="set-main-library"
            @click="setMainLibrary(entry)"
          >
            <AppIcon v-if="entry.id === settings.mainLibraryId" name="check" />
            {{ t('library.catalog.primaryShort') }}
          </AppButton>
          <AppButton
            :aria-label="t('library.catalog.export', { name: entry.name })"
            data-testid="export-library"
            @click="library.exportLibrary(entry.id)"
          >
            <AppIcon name="export" />
            {{ t('library.name.menu.export') }}
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

    <form class="library_list_create" @submit.prevent="create">
      <AppInput
        v-model="newName"
        :label="t('library.catalog.create.label')"
        :placeholder="t('library.catalog.create.placeholder')"
      />
      <AppButton type="submit" variant="primary" data-testid="create-library">
        {{ t('library.catalog.create.submit') }}
      </AppButton>
    </form>

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

    &_info {
      display: flex;
      flex-direction: column;
      min-width: 0;
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

  &_create {
    display: flex;
    gap: $space_sm;
    align-items: flex-end;
  }
}
</style>
