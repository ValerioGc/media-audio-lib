<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { LIBRARY_CONTENT_TABS, type LibraryContentTab } from '@/types/library';

defineProps<{
  modelValue: LibraryContentTab;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: LibraryContentTab];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="library_content_tabs" role="tablist" :aria-label="t('library.tabs.label')">
    <button
      v-for="tab in LIBRARY_CONTENT_TABS"
      :id="`library-tab-${tab}`"
      :key="tab"
      class="library_content_tabs_tab"
      :class="{ library_content_tabs_tab_active: tab === modelValue }"
      type="button"
      role="tab"
      :aria-selected="tab === modelValue"
      :aria-controls="`library-panel-${tab}`"
      :tabindex="tab === modelValue ? 0 : -1"
      @click="emit('update:modelValue', tab)"
    >
      {{ t(`library.tabs.${tab}`) }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.library_content_tabs {
  display: flex;
  gap: $space_xs;
  align-items: center;
  overflow-x: auto;
  padding-bottom: $space_xs;

  &_tab {
    flex: 0 0 auto;
    min-height: 2rem;
    padding: $space_sm $space_md;
    border: 1px solid transparent;
    border-radius: $radius_md;
    background-color: transparent;
    color: var(--color_text_muted);
    font: inherit;
    cursor: pointer;
    transition:
      background-color $duration_fast ease,
      color $duration_fast ease,
      border-color $duration_fast ease;

    @include focus_ring;

    &:hover {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    &_active {
      border-color: var(--color_border_strong);
      background-color: var(--color_surface_alt);
      color: var(--color_text);
      font-weight: 600;
    }
  }
}
</style>
