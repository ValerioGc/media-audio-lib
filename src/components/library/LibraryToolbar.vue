<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppInput from '@/components/common/AppInput.vue';
import LibraryImportButton from '@/components/library/LibraryImportButton.vue';
import LibraryViewToggle from '@/components/library/LibraryViewToggle.vue';
import { useLibraryStore } from '@/stores/library';
import type { ViewMode } from '@/types/settings';

defineProps<{ viewMode?: ViewMode | undefined; selectedCount?: number }>();
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

    <p class="library_toolbar_counts">
      <span data-testid="track-count">{{
        t('library.toolbar.count', { count: library.tracks.length }, library.tracks.length)
      }}</span>
      <span v-if="library.missingCount > 0" class="library_toolbar_missing">
        {{ t('library.toolbar.missing', { count: library.missingCount }, library.missingCount) }}
      </span>
      <span
        v-if="library.missingInfoFilter !== 'all'"
        class="library_toolbar_missing"
        data-testid="missing-info-active"
      >
        {{
          t('library.toolbar.missingInfo.active', {
            filter: t(`library.toolbar.missingInfo.options.${library.missingInfoFilter}`),
          })
        }}
      </span>
    </p>

    <AppButton
      v-if="(selectedCount ?? 0) > 1"
      data-testid="bulk-edit-open"
      @click="emit('editSelected')"
    >
      {{ t('library.toolbar.editSelected', { count: selectedCount }) }}
    </AppButton>

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

  &_counts {
    display: flex;
    flex-wrap: wrap;
    gap: $space_sm;
    align-items: center;
    color: var(--color_text_muted);
    font-size: 0.875em;
  }

  &_missing {
    padding: 0 $space_sm;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_sm;
  }

  &_view {
    margin-left: auto;
  }
}
</style>
