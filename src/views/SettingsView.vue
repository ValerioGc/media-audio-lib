<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import BackToLibrary from '@/components/layout/BackToLibrary.vue';
import AccentColorPicker from '@/components/settings/AccentColorPicker.vue';
import AmbienceToggle from '@/components/settings/AmbienceToggle.vue';
import CoverGradientToggle from '@/components/settings/CoverGradientToggle.vue';
import DefaultPlayerPanel from '@/components/settings/DefaultPlayerPanel.vue';
import ImportExportPanel from '@/components/settings/ImportExportPanel.vue';
import LanguageSelect from '@/components/settings/LanguageSelect.vue';
import LibraryCreateForm from '@/components/settings/LibraryCreateForm.vue';
import LibraryList from '@/components/settings/LibraryList.vue';
import SettingsAppInfo from '@/components/settings/SettingsAppInfo.vue';
import SettingsSection from '@/components/settings/SettingsSection.vue';
import SettingsTabs from '@/components/settings/SettingsTabs.vue';
import TextSizeSelect from '@/components/settings/TextSizeSelect.vue';
import ThemeSwitch from '@/components/settings/ThemeSwitch.vue';

const { t } = useI18n();

const tabs = computed(() => [
  { id: 'library', label: t('settings.tabs.library') },
  { id: 'general', label: t('settings.tabs.general') },
  { id: 'appearance', label: t('settings.tabs.appearance') },
]);
</script>

<template>
  <div class="settings_view">
    <div class="settings_view_bar">
      <BackToLibrary />
      <SettingsAppInfo />
    </div>

    <header class="settings_view_header">
      <h1 class="settings_view_title">{{ t('settings.title') }}</h1>
      <p class="settings_view_subtitle">{{ t('settings.subtitle') }}</p>
    </header>

    <SettingsTabs :tabs="tabs">
      <template #library>
        <div class="settings_view_group">
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
            <LibraryCreateForm />
            <LibraryList />
          </SettingsSection>
        </div>
      </template>
      <template #general>
        <div class="settings_view_group">
          <SettingsSection
            :title="t('settings.language.title')"
            :description="t('settings.language.description')"
          >
            <LanguageSelect />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.defaultPlayer.title')"
            :description="t('settings.defaultPlayer.description')"
          >
            <DefaultPlayerPanel />
          </SettingsSection>
        </div>
      </template>

      <template #appearance>
        <div class="settings_view_group">
          <div class="settings_view_divider">
            <span>{{ t('settings.appearance.application') }}</span>
          </div>

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
            :title="t('settings.accent.title')"
            :description="t('settings.accent.description')"
          >
            <AccentColorPicker />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.ambience.title')"
            :description="t('settings.ambience.description')"
          >
            <AmbienceToggle />
          </SettingsSection>

          <div class="settings_view_divider">
            <span>{{ t('settings.appearance.player') }}</span>
          </div>

          <SettingsSection
            :title="t('settings.coverGradient.title')"
            :description="t('settings.coverGradient.description')"
          >
            <CoverGradientToggle />
          </SettingsSection>
        </div>
      </template>
    </SettingsTabs>
  </div>
</template>

<style scoped lang="scss">
.settings_view {
  display: flex;
  flex-direction: column;
  gap: $space_lg;

  @include page_column;

  // The way back and the app info share the first line of the page.
  &_bar {
    display: flex;
    flex-wrap: wrap;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
  }

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

  &_divider {
    display: flex;
    gap: $space_md;
    align-items: center;
    color: var(--color_text_muted);
    font-size: 0.8em;
    font-weight: 700;
    text-transform: uppercase;

    &::after {
      flex: 1;
      height: 1px;
      background-color: var(--color_border);
      content: '';
    }
  }
}
</style>
