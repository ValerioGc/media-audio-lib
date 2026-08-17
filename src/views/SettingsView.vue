<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import LanguageSelect from '@/components/settings/LanguageSelect.vue';
import SettingsSection from '@/components/settings/SettingsSection.vue';
import TextSizeSelect from '@/components/settings/TextSizeSelect.vue';
import ThemeSwitch from '@/components/settings/ThemeSwitch.vue';

const { t } = useI18n();
</script>

<template>
  <div class="settings_view">
    <header class="settings_view_header">
      <h1 class="settings_view_title">{{ t('settings.title') }}</h1>
      <p class="settings_view_subtitle">{{ t('settings.subtitle') }}</p>
    </header>

    <SettingsSection
      :title="t('settings.language.title')"
      :description="t('settings.language.description')"
    >
      <LanguageSelect />
    </SettingsSection>

    <SettingsSection
      :title="t('settings.textSize.title')"
      :description="t('settings.textSize.description')"
    >
      <TextSizeSelect />
    </SettingsSection>

    <SettingsSection
      :title="t('settings.theme.title')"
      :description="t('settings.theme.description')"
    >
      <ThemeSwitch />
    </SettingsSection>
  </div>
</template>

<style scoped lang="scss">
.settings_view {
  display: flex;
  flex-direction: column;
  gap: $space_lg;
  max-width: 46rem;

  &_header {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
  }

  &_title {
    font-size: 1.75em;
    font-weight: 600;
  }

  &_subtitle {
    color: var(--color_text_muted);
  }
}
</style>
