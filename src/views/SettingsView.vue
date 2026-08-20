<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import BackToLibrary from '@/components/layout/BackToLibrary.vue';
import CoverGradientToggle from '@/components/settings/CoverGradientToggle.vue';
import DefaultPlayerPanel from '@/components/settings/DefaultPlayerPanel.vue';
import ImportExportPanel from '@/components/settings/ImportExportPanel.vue';
import LanguageSelect from '@/components/settings/LanguageSelect.vue';
import LibraryList from '@/components/settings/LibraryList.vue';
import LibraryNameForm from '@/components/settings/LibraryNameForm.vue';
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
    <BackToLibrary />

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

          <SettingsSection
            :title="t('settings.coverGradient.title')"
            :description="t('settings.coverGradient.description')"
          >
            <CoverGradientToggle />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.defaultPlayer.title')"
            :description="t('settings.defaultPlayer.description')"
          >
            <DefaultPlayerPanel />
          </SettingsSection>
        </div>
      </template>

      <template #library>
        <div class="settings_view_group">
          <SettingsSection
            :title="t('settings.libraryName.title')"
            :description="t('settings.libraryName.description')"
          >
            <LibraryNameForm />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.importExport.title')"
            :description="t('settings.importExport.description')"
          >
            <ImportExportPanel />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.libraries.title')"
            :description="t('settings.libraries.description')"
          >
            <LibraryList />
          </SettingsSection>
        </div>
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

  @include page_column;

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
