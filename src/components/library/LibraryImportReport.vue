<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import type { AddReport } from '@/types/library';

const props = defineProps<{ report: AddReport }>();

const emit = defineEmits<{ dismiss: [] }>();

/** How long a clean import stays on screen before dismissing itself. */
const AUTO_DISMISS_MS = 6000;

const { t } = useI18n();

/** An import that lost files stays until the user has read it and closed it. */
const hasFailures = computed(() => props.report.failed.length > 0);

const timeoutId = ref<ReturnType<typeof setTimeout> | null>(null);
// Restarting the animation needs a fresh element, hence a key that changes per report.
const runId = ref(0);

function stopTimer() {
  if (timeoutId.value !== null) {
    clearTimeout(timeoutId.value);
    timeoutId.value = null;
  }
}

watch(
  () => props.report,
  () => {
    stopTimer();
    runId.value += 1;

    if (!hasFailures.value) {
      timeoutId.value = setTimeout(() => emit('dismiss'), AUTO_DISMISS_MS);
    }
  },
  { immediate: true },
);

onBeforeUnmount(stopTimer);

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
  <section
    v-if="lines.length > 0"
    class="library_report"
    :class="{ library_report_blocking: hasFailures }"
    data-testid="import-report"
    :role="hasFailures ? 'alert' : 'status'"
  >
    <div class="library_report_content">
      <h2 class="library_report_title">
        <AppIcon v-if="hasFailures" name="warning" />
        {{ t('library.report.title') }}
      </h2>
      <ul class="library_report_list">
        <li v-for="line in lines" :key="line.key" :data-testid="`report-${line.key}`">
          {{ line.text }}
        </li>
      </ul>
      <ul v-if="hasFailures" class="library_report_failures">
        <li v-for="failure in report.failed" :key="failure.path">
          <code>{{ failure.path }}</code> — {{ failure.reason }}
        </li>
      </ul>
    </div>

    <AppButton variant="ghost" @click="emit('dismiss')">
      {{ t('library.report.dismiss') }}
    </AppButton>

    <!-- Visible countdown: the bar drains over the time left before the banner goes. -->
    <div
      v-if="!hasFailures"
      :key="runId"
      class="library_report_countdown"
      data-testid="report-countdown"
      :style="{ animationDuration: `${AUTO_DISMISS_MS}ms` }"
      aria-hidden="true"
    />
  </section>
</template>

<style scoped lang="scss">
.library_report {
  position: relative;
  display: flex;
  gap: $space_md;
  align-items: flex-start;
  justify-content: space-between;
  overflow: hidden;
  padding: $space_md;
  @include surface_panel($radius_lg, var(--color_surface_alt));

  &_blocking {
    border-color: var(--color_border_strong);
  }

  &_content {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
  }

  &_title {
    display: flex;
    gap: $space_xs;
    align-items: center;
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

  &_countdown {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 3px;
    background-color: var(--color_accent);
    transform-origin: left center;
    animation-name: drain;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }
}

@keyframes drain {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .library_report_countdown {
    animation: none;
  }
}
</style>
