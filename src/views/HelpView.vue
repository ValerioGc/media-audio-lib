<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import HelpTopicCard from '@/components/help/HelpTopicCard.vue';
import BackToLibrary from '@/components/layout/BackToLibrary.vue';
import { HELP_TOPICS } from '@/config/help';

const { t } = useI18n();
</script>

<template>
  <div class="help_view">
    <BackToLibrary />

    <header class="help_view_header">
      <h1 class="help_view_title">{{ t('help.title') }}</h1>
      <p class="help_view_subtitle">{{ t('help.subtitle') }}</p>
    </header>

    <div class="help_view_topics">
      <HelpTopicCard v-for="topic in HELP_TOPICS" :key="topic" :topic="topic" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.help_view {
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

  &_topics {
    display: flex;
    flex-direction: column;
    gap: $space_md;
  }
}
</style>
