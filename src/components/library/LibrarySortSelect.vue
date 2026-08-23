<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import AppSelect from '@/components/common/AppSelect.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import type { SortDirection } from '@/types/library';
import type { SelectOption } from '@/types/ui';

/**
 * The order of a view that has no column headers to click.
 *
 * It only draws and reports: the tracks answer to the library store, the artists and the
 * albums to the list that gathers them, and both drive the same control.
 */
const props = defineProps<{
  column: string;
  direction: SortDirection;
  options: readonly SelectOption[];
}>();

const emit = defineEmits<{ select: [column: string] }>();

const { t } = useI18n();

const directionLabel = computed(() =>
  props.direction === 'asc' ? t('library.sort.ascending') : t('library.sort.descending'),
);

/** Asking again for the column in use is what turns the order around. */
function toggleDirection() {
  emit('select', props.column);
}
</script>

<template>
  <div class="library_sort_select">
    <AppSelect
      class="library_sort_select_field"
      :model-value="props.column"
      :options="props.options"
      :label="t('library.sort.field')"
      hide-label
      data-testid="preview-sort-field"
      @update:model-value="emit('select', $event)"
    />

    <AppTooltip :text="directionLabel" align="center">
      <button
        class="library_sort_select_direction"
        type="button"
        :aria-label="directionLabel"
        data-testid="preview-sort-direction"
        @click="toggleDirection"
      >
        <AppIcon :name="props.direction === 'asc' ? 'sortAsc' : 'sortDesc'" />
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

    :deep(.app_select_field) {
      border-color: var(--color_accent);
      background-color: var(--color_accent);
      color: var(--color_on_accent);

      &:hover {
        background-color: var(--color_accent_hover);
      }
    }
  }

  &_direction {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--color_accent);
    border-radius: $radius_md;
    background-color: var(--color_accent);
    color: var(--color_on_accent);
    font: inherit;
    cursor: pointer;
    transition: background-color $duration_fast ease;

    &:hover {
      background-color: var(--color_accent_hover);
    }

    @include focus_ring;
  }
}
</style>
