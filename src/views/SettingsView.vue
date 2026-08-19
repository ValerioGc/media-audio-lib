<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppPlaceholder from '@/components/common/AppPlaceholder.vue';
import LanguageSelect from '@/components/settings/LanguageSelect.vue';
import SettingsFooter from '@/components/settings/SettingsFooter.vue';
import SettingsSection from '@/components/settings/SettingsSection.vue';
import SettingsTabs from '@/components/settings/SettingsTabs.vue';
import TextSizeSelect from '@/components/settings/TextSizeSelect.vue';
import ThemeSwitch from '@/components/settings/ThemeSwitch.vue';

const { t } = useI18n();

const tabs = computed(() => [
  { id: 'general', label: t('settings.tabs.general') },
  { id: 'library', label: t('settings.tabs.library') },
]);
</script>

<template>
  <div class="settings_view">
    <header class="settings_view_header">
      <h1 class="settings_view_title">{{ t('settings.title') }}</h1>
      <p class="settings_view_subtitle">{{ t('settings.subtitle') }}</p>
    </header>

    <SettingsTabs :tabs="tabs">
      <template #general>
        <div class="settings_view_group">
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

      <template #library>
        <AppPlaceholder
          :title="t('settings.libraryTab.title')"
          :message="t('settings.libraryTab.empty')"
        />
      </template>
    </SettingsTabs>

    <SettingsFooter />
  </div>
</template>

<style scoped lang="scss">
.settings_view {
  display: flex;
  flex-direction: column;
  gap: $space_lg;
  width: 100%;
  max-width: 46rem;
  margin: 0 auto;

  &_header {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    text-align: center;
  }

  &_title {
    font-size: 1.75em;
    font-weight: 600;
  }

  &_subtitle {
    color: var(--color_text_muted);
  }

  &_group {
    display: flex;
    flex-direction: column;
    gap: $space_lg;
  }
}
</style>
