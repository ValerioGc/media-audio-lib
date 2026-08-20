<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import { APP_NAME, APP_VERSION, GITHUB_URL } from '@/config/app-config';
import { openExternal } from '@/services/external-link';

const { t } = useI18n();

async function openRepository() {
  await openExternal(GITHUB_URL);
}
</script>

<template>
  <footer class="settings_footer">
    <p class="settings_footer_app">
      <span class="settings_footer_name">{{ APP_NAME }}</span>
      <span class="settings_footer_version">{{
        t('settings.footer.version', { version: APP_VERSION })
      }}</span>
    </p>

    <button
      class="settings_footer_link"
      type="button"
      data-testid="github-link"
      @click="openRepository"
    >
      {{ t('settings.footer.repository') }}
      <AppIcon name="external" />
    </button>
  </footer>
</template>

<style scoped lang="scss">
.settings_footer {
  display: flex;
  flex-wrap: wrap;
  gap: $space_sm;
  align-items: center;
  justify-content: center;
  padding-top: $space_md;
  border-top: 1px solid var(--color_border);
  color: var(--color_text_muted);
  font-size: 0.875em;

  &_app {
    display: flex;
    gap: $space_sm;
    align-items: baseline;
  }

  &_name {
    font-weight: 600;
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
