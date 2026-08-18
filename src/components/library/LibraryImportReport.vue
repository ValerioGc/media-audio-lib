<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import type { AddReport } from '@/types/library';

const props = defineProps<{ report: AddReport }>();

const emit = defineEmits<{ dismiss: [] }>();

const { t } = useI18n();

const lines = computed(() =>
  (
    [
      { key: 'added', count: props.report.added.length },
      { key: 'duplicates', count: props.report.duplicates.length },
      { key: 'failed', count: props.report.failed.length },
    ] as const
  )
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      key: entry.key,
      text: t(`library.report.${entry.key}`, { count: entry.count }, entry.count),
    })),
);
</script>

<template>
  <section v-if="lines.length > 0" class="library_report" data-testid="import-report">
    <div class="library_report_content">
      <h2 class="library_report_title">{{ t('library.report.title') }}</h2>
      <ul class="library_report_list">
        <li v-for="line in lines" :key="line.key" :data-testid="`report-${line.key}`">
          {{ line.text }}
        </li>
      </ul>
      <ul v-if="report.failed.length > 0" class="library_report_failures">
        <li v-for="failure in report.failed" :key="failure.path">
          <code>{{ failure.path }}</code> — {{ failure.reason }}
        </li>
      </ul>
    </div>
    <AppButton variant="ghost" @click="emit('dismiss')">
      {{ t('library.report.dismiss') }}
    </AppButton>
  </section>
</template>

<style scoped lang="scss">
.library_report {
  display: flex;
  gap: $space_md;
  align-items: flex-start;
  justify-content: space-between;
  padding: $space_md;
  border: 1px solid var(--color_border);
  border-radius: $radius_lg;
  background-color: var(--color_surface_alt);

  &_content {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
  }

  &_title {
    font-size: 1em;
    font-weight: 600;
  }

  &_list,
  &_failures {
    margin: 0;
    padding-left: $space_lg;
    color: var(--color_text_muted);
  }

  &_failures {
    font-size: 0.875em;
    word-break: break-all;
  }
}
</style>
