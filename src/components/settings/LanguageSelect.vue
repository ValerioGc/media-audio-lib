<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppOptionGroup from '@/components/common/AppOptionGroup.vue';
import flagGb from '@/assets/icons/flag-gb.svg';
import flagIt from '@/assets/icons/flag-it.svg';
import { useSettingsStore } from '@/stores/settings';
import { LOCALES, type Locale } from '@/types/settings';

/** The same flags the GitHub Pages site uses for its language switcher. */
const FLAGS: Record<Locale, string> = { it: flagIt, en: flagGb };

const { t } = useI18n();
const settings = useSettingsStore();

const options = computed(() =>
  LOCALES.map((locale) => ({
    value: locale,
    label: t(`settings.language.options.${locale}`),
    icon: FLAGS[locale],
  })),
);

function onSelect(value: string) {
  void settings.setLocale(value as Locale);
}
</script>

<template>
  <!-- A group rather than a dropdown: a native option cannot carry the flag beside its
       label, and with a handful of languages every choice is visible at once. -->
  <AppOptionGroup
    :model-value="settings.locale"
    :options="options"
    :legend="t('settings.language.title')"
    @update:model-value="onSelect"
  />
</template>
