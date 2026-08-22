<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import { formatBytes } from '@/services/file-size';
import { clearCoverCache, coverCacheSize } from '@/services/library-api';
import type { CoverCacheReport } from '@/types/library';

const { t, locale } = useI18n();

const report = ref<CoverCacheReport>({ bytes: 0, limitBytes: 0 });
const isClearing = ref(false);
const wasCleared = ref(false);

const isEmpty = computed(() => report.value.bytes === 0);
const size = computed(() => formatBytes(report.value.bytes, locale.value));
const limit = computed(() => formatBytes(report.value.limitBytes, locale.value));

/** A cache that cannot be measured is reported as empty: there is nothing to offer. */
async function readSize() {
  try {
    report.value = await coverCacheSize();
  } catch {
    report.value = { bytes: 0, limitBytes: 0 };
  }
}

async function clear() {
  isClearing.value = true;
  wasCleared.value = false;

  try {
    report.value = await clearCoverCache();
    wasCleared.value = true;
  } catch {
    await readSize();
  } finally {
    isClearing.value = false;
  }
}

onMounted(readSize);
</script>

<template>
  <div class="cover_cache_panel">
    <div class="cover_cache_panel_row">
      <p class="cover_cache_panel_size" data-testid="cover-cache-size">
        {{ isEmpty ? t('settings.coverCache.empty') : t('settings.coverCache.size', { size }) }}
      </p>

      <AppButton :disabled="isClearing || isEmpty" data-testid="clear-cover-cache" @click="clear">
        <AppIcon name="remove" />
        {{ isClearing ? t('settings.coverCache.clearing') : t('settings.coverCache.clear') }}
      </AppButton>
    </div>

    <p v-if="report.limitBytes > 0" class="cover_cache_panel_hint">
      {{ t('settings.coverCache.limit', { limit }) }}
    </p>

    <output v-if="wasCleared" class="cover_cache_panel_done">
      {{ t('settings.coverCache.cleared') }}
    </output>
  </div>
</template>

<style scoped lang="scss">
.cover_cache_panel {
  display: flex;
  flex-direction: column;
  gap: $space_sm;

  &_row {
    display: flex;
    gap: $space_md;
    align-items: center;
    justify-content: space-between;
  }

  &_size {
    font-variant-numeric: tabular-nums;
  }

  &_hint {
    color: var(--color_text_muted);
    font-size: 0.875em;
  }

  &_done {
    padding: $space_sm $space_md;
    @include surface_panel($radius_md, var(--color_surface_alt));
    font-size: 0.875em;
  }
}
</style>
