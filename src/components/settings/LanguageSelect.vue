<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppSelect from '@/components/common/AppSelect.vue';
import { useSettingsStore } from '@/stores/settings';
import { LOCALES, type Locale } from '@/types/settings';

const { t } = useI18n();
const settings = useSettingsStore();

const options = computed(() =>
  LOCALES.map((locale) => ({ value: locale, label: t(`settings.language.options.${locale}`) })),
);

function onSelect(value: string) {
  void settings.setLocale(value as Locale);
}
</script>

<template>
  <AppSelect
    :model-value="settings.locale"
    :options="options"
    :label="t('settings.language.title')"
    @update:model-value="onSelect"
  />
</template>
