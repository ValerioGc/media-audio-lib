<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import type { IconName } from '@/config/icons';
import { useSettingsStore } from '@/stores/settings';
import { VIEW_MODES, type ViewMode } from '@/types/settings';

const { t } = useI18n();
const settings = useSettingsStore();

const ICONS: Record<ViewMode, IconName> = { table: 'list', preview: 'grid' };

const options = computed(() =>
  VIEW_MODES.map((mode) => ({
    mode,
    icon: ICONS[mode],
    label: t(`library.view.${mode}`),
    active: settings.viewMode === mode,
  })),
);
</script>

<template>
  <div class="library_view_toggle" role="group" :aria-label="t('library.view.label')">
    <AppTooltip v-for="option in options" :key="option.mode" :text="option.label">
      <AppButton
        variant="ghost"
        :class="{ library_view_toggle_active: option.active }"
        :aria-label="option.label"
        :aria-pressed="option.active"
        :data-testid="`view-${option.mode}`"
        @click="settings.setViewMode(option.mode)"
      >
        <AppIcon :name="option.icon" />
      </AppButton>
    </AppTooltip>
  </div>
</template>

<style scoped lang="scss">
.library_view_toggle {
  display: flex;
  gap: $space_xs;
  padding: $space_xs;
  border: 1px solid var(--color_border);
  border-radius: $radius_lg;
  background-color: var(--color_surface_alt);

  &_active {
    background-color: var(--color_accent);
    color: var(--color_on_accent);

    &:hover:not(:disabled) {
      background-color: var(--color_accent_hover);
    }
  }
}
</style>
