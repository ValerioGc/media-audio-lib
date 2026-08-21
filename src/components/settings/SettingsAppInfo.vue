<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import { APP_NAME, APP_VERSION, GITHUB_URL, WEBSITE_URL } from '@/config/app-config';
import { openExternal } from '@/services/external-link';

const { t } = useI18n();

async function openWebsite() {
  await openExternal(WEBSITE_URL);
}

async function openRepository() {
  await openExternal(GITHUB_URL);
}
</script>

<template>
  <div class="settings_app_info">
    <p class="settings_app_info_app">
      <span class="settings_app_info_name">{{ APP_NAME }}</span>
      <span class="settings_app_info_version">{{ APP_VERSION }}</span>
    </p>

    <button
      class="settings_app_info_link"
      type="button"
      data-testid="website-link"
      @click="openWebsite"
    >
      {{ t('settings.about.website') }}
      <AppIcon name="external" />
    </button>

    <button
      class="settings_app_info_link"
      type="button"
      data-testid="github-link"
      @click="openRepository"
    >
      {{ t('settings.about.repository') }}
      <AppIcon name="external" />
    </button>
  </div>
</template>

<style scoped lang="scss">
// The name, the version and the two links read as one line beside the way back, and wrap
// onto lines of their own when the window is too narrow to hold them.
.settings_app_info {
  display: flex;
  flex-wrap: wrap;
  gap: $space_2xs $space_sm;
  align-items: center;
  justify-content: flex-end;
  color: var(--color_text_muted);
  font-size: 0.875em;

  &_app {
    display: flex;
    gap: $space_xs;
    align-items: baseline;
  }

  &_name {
    font-weight: 600;
  }

  &_version {
    font-variant-numeric: tabular-nums;
  }

  &_link {
    display: inline-flex;
    gap: $space_xs;
    align-items: center;
    padding: $space_xs $space_sm;
    border: 0;
    border-radius: $radius_sm;
    background: none;
    color: var(--color_accent);
    font: inherit;
    cursor: pointer;

    &:hover {
      background-color: var(--color_surface_hover);
      text-decoration: underline;
    }

    @include focus_ring;
  }
}
</style>
