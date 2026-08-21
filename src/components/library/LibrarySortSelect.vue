<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import AppSelect from '@/components/common/AppSelect.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import { useLibraryStore } from '@/stores/library';
import { SORTABLE_COLUMNS, type SortableColumn } from '@/types/library';

const { t } = useI18n();
const library = useLibraryStore();

const options = computed(() =>
  SORTABLE_COLUMNS.map((column) => ({
    value: column,
    label: t(`library.columns.${column}`),
  })),
);

const directionLabel = computed(() =>
  library.sort.direction === 'asc' ? t('library.sort.ascending') : t('library.sort.descending'),
);

function onFieldChange(value: string) {
  if (value !== library.sort.column) {
    library.toggleSort(value as SortableColumn);
  }
}

/** Sorting the column already in use is what turns the order around. */
function toggleDirection() {
  library.toggleSort(library.sort.column);
}
</script>

<template>
  <div class="library_sort_select">
    <AppSelect
      class="library_sort_select_field"
      :model-value="library.sort.column"
      :options="options"
      :label="t('library.sort.field')"
      hide-label
      data-testid="preview-sort-field"
      @update:model-value="onFieldChange"
    />

    <AppTooltip :text="directionLabel" align="center">
      <button
        class="library_sort_select_direction"
        type="button"
        :aria-label="directionLabel"
        data-testid="preview-sort-direction"
        @click="toggleDirection"
      >
        <AppIcon :name="library.sort.direction === 'asc' ? 'sortAsc' : 'sortDesc'" />
      </button>
    </AppTooltip>
  </div>
</template>

<style scoped lang="scss">
.library_sort_select {
  display: flex;
  gap: $space_xs;
  align-items: center;

  &_field {
    min-width: 8rem;
  }

  &_direction {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_md;
    background-color: var(--color_surface);
    color: var(--color_text);
    font: inherit;
    cursor: pointer;
    transition: background-color $duration_fast ease;

    &:hover {
      background-color: var(--color_surface_hover);
    }

    @include focus_ring;
  }
}
</style>
