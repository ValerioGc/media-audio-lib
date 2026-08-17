<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppPlaceholder from '@/components/common/AppPlaceholder.vue';

const { t } = useI18n();
</script>

<template>
  <AppPlaceholder :title="t('player.title')" :message="t('player.placeholder')" />
</template>
