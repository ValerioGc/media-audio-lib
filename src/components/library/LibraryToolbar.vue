<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppInput from '@/components/common/AppInput.vue';
import LibraryImportButton from '@/components/library/LibraryImportButton.vue';
import LibrarySortSelect from '@/components/library/LibrarySortSelect.vue';
import PreviewSizeToggle from '@/components/library/PreviewSizeToggle.vue';
import LibraryViewToggle from '@/components/library/LibraryViewToggle.vue';
import { useLibraryStore } from '@/stores/library';
import { SORTABLE_COLUMNS, type SortableColumn } from '@/types/library';
import type { ViewMode } from '@/types/settings';

withDefaults(
  defineProps<{
    viewMode?: ViewMode | undefined;
    selectedCount?: number | undefined;
    /** The preview has no column headers to sort from: it gets the control instead. */
    showSort?: boolean;
    /** Only the preview has cards, so only the preview is asked how large they should be. */
    showPreviewSize?: boolean;
  }>(),
  { viewMode: undefined, selectedCount: 0, showPreviewSize: false },
);
const emit = defineEmits<{
  'update:viewMode': [mode: ViewMode];
  editSelected: [];
}>();

const { t } = useI18n();
const library = useLibraryStore();

const searchValue = computed({
  get: () => library.query,
  set: (value: string) => library.setQuery(value),
});

const sortOptions = computed(() =>
  SORTABLE_COLUMNS.map((column) => ({
    value: column,
    label: t(`library.columns.${column}`),
  })),
);

function sortBy(column: string) {
  library.toggleSort(column as SortableColumn);
}
</script>

<template>
  <div class="library_toolbar">
    <LibraryImportButton />

    <AppInput
      v-model="searchValue"
      class="library_toolbar_search"
      type="search"
      hide-label
      :label="t('library.toolbar.search')"
      :placeholder="t('library.toolbar.searchPlaceholder')"
    />

    <AppButton
      v-if="(selectedCount ?? 0) > 1"
      data-testid="bulk-edit-open"
      @click="emit('editSelected')"
    >
      {{ t('library.toolbar.editSelected', { count: selectedCount }) }}
    </AppButton>

    <LibrarySortSelect
      v-if="showSort"
      class="library_toolbar_sort"
      :column="library.sort.column"
      :direction="library.sort.direction"
      :options="sortOptions"
      @select="sortBy"
    />

    <PreviewSizeToggle v-if="showPreviewSize" class="library_toolbar_preview_size" />

    <!-- The view switch sits at the far right of the toolbar. -->
    <LibraryViewToggle
      class="library_toolbar_view"
      :model-value="viewMode"
      @update:model-value="emit('update:viewMode', $event)"
    />
  </div>
</template>

<style scoped lang="scss">
.library_toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: $space_md;
  align-items: center;

  &_search {
    flex: 1;
    min-width: 12rem;
    max-width: 22rem;
  }

  &_sort {
    margin-left: auto;
  }

  &_view {
    margin-left: auto;
  }

  // With both on screen the sort keeps its place and only the switch is pushed right.
  &_sort + &_view {
    margin-left: 0;
  }
}
</style>
