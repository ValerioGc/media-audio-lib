<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppSelect from '@/components/common/AppSelect.vue';
import { useLibraryStore } from '@/stores/library';
import type { LibraryImportStrategy } from '@/types/library';
import type { SelectOption } from '@/types/ui';

const { t } = useI18n();
const library = useLibraryStore();
const strategy = ref<LibraryImportStrategy>('mergeSkipDuplicates');

const strategyOptions = computed<SelectOption[]>(() =>
  (['replace', 'merge', 'mergeSkipDuplicates'] as const).map((value) => ({
    value,
    label: t(`settings.importExport.strategy.options.${value}`),
  })),
);

async function exportActive() {
  if (library.activeLibraryId !== null) {
    await library.exportLibrary(library.activeLibraryId);
  }
}
</script>

<template>
  <div class="import_export_panel">
    <div class="import_export_panel_controls">
      <AppSelect
        v-model="strategy"
        class="import_export_panel_strategy"
        :label="t('settings.importExport.strategy.label')"
        :options="strategyOptions"
      />

      <div class="import_export_panel_actions">
        <AppButton
          :disabled="library.isLibraryImporting"
          data-testid="import-library-file"
          @click="library.importLibrary(strategy)"
        >
          <AppIcon name="import" />
          {{
            library.isLibraryImporting
              ? t('settings.importExport.importing')
              : t('settings.importExport.import')
          }}
        </AppButton>

        <AppButton
          :disabled="library.activeLibraryId === null"
          data-testid="export-active-library"
          @click="exportActive"
        >
          <AppIcon name="export" />
          {{ t('settings.importExport.export') }}
        </AppButton>
      </div>
    </div>

    <output v-if="library.lastLibraryImport !== null" class="import_export_panel_report">
      <span>
        {{
          t('settings.importExport.report.summary', {
            total: library.lastLibraryImport.total,
            added: library.lastLibraryImport.added,
            updated: library.lastLibraryImport.updated,
            skipped: library.lastLibraryImport.skipped,
            missing: library.lastLibraryImport.missing.length,
          })
        }}
      </span>
      <AppButton variant="ghost" @click="library.dismissLibraryImport()">
        {{ t('library.report.dismiss') }}
      </AppButton>
    </output>
  </div>
</template>

<style scoped lang="scss">
.import_export_panel {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_controls {
    display: flex;
    gap: $space_md;
    align-items: flex-end;
    justify-content: space-between;
  }

  &_strategy {
    flex: 1;
  }

  &_actions {
    display: flex;
    flex-shrink: 0;
    gap: $space_sm;
  }

  &_report {
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
    padding: $space_sm $space_md;
    @include surface_panel($radius_md, var(--color_surface_alt));
    font-size: 0.875em;
  }
}
</style>
