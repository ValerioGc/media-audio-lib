<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppPlaceholder from '@/components/common/AppPlaceholder.vue';

const { t } = useI18n();
</script>

<template>
  <AppPlaceholder :title="t('library.title')" :message="t('library.placeholder')" />
</template>
