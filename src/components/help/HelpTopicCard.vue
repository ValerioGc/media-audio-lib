<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import { HELP_TOPIC_ICONS, type HelpTopic } from '@/config/help';

const props = defineProps<{ topic: HelpTopic }>();

const { t, tm, rt } = useI18n();

const icon = computed(() => HELP_TOPIC_ICONS[props.topic]);

/** The steps are a list in the translation files, so each language sets its own length. */
const steps = computed(() =>
  (tm(`help.topics.${props.topic}.steps`) as unknown[]).map((step) => rt(step as string)),
);
</script>

<template>
  <article class="help_topic" :data-topic="topic">
    <header class="help_topic_header">
      <span class="help_topic_icon" aria-hidden="true">
        <AppIcon :name="icon" />
      </span>
      <h2 class="help_topic_title">{{ t(`help.topics.${topic}.title`) }}</h2>
    </header>

    <p class="help_topic_where">
      <span class="help_topic_label">{{ t('help.where') }}</span>
      {{ t(`help.topics.${topic}.where`) }}
    </p>

    <ol class="help_topic_steps">
      <li v-for="(step, index) in steps" :key="index">{{ step }}</li>
    </ol>

    <p class="help_topic_tip">
      <span class="help_topic_label">{{ t('help.tip') }}</span>
      {{ t(`help.topics.${topic}.tip`) }}
    </p>
  </article>
</template>

<style scoped lang="scss">
.help_topic {
  display: flex;
  flex-direction: column;
  gap: $space_sm;
  padding: $space_lg;
  @include glass_surface($radius_lg);
  box-shadow: var(--shadow_card);

  &_header {
    display: flex;
    gap: $space_sm;
    align-items: center;
  }

  &_icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: $radius_md;
    background-color: var(--color_accent_soft);
    color: var(--color_accent);
  }

  &_title {
    font-size: 1.125em;
    font-weight: 600;
  }

  &_where {
    color: var(--color_text_muted);
  }

  &_label {
    margin-right: $space_xs;
    font-weight: 600;
  }

  &_steps {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    margin: 0;
    padding-left: $space_lg;
  }

  // The one thing worth knowing that is not a step: set apart so it is not read as one.
  &_tip {
    padding: $space_sm $space_md;
    border-left: 3px solid var(--color_accent);
    border-radius: $radius_sm;
    background-color: var(--color_accent_soft);
    font-size: 0.9375em;
  }
}
</style>
