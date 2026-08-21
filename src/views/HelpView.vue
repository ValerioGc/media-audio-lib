<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import HelpTopicCard from '@/components/help/HelpTopicCard.vue';
import BackToLibrary from '@/components/layout/BackToLibrary.vue';
import { HELP_TOPICS, HELP_TOPIC_ICONS, type HelpTopic } from '@/config/help';

const { t } = useI18n();

/** One topic at a time: the guide is long, and the index says what else is in it. */
const openTopic = ref<HelpTopic>(HELP_TOPICS[0]);
</script>

<template>
  <div class="help_view">
    <BackToLibrary />

    <header class="help_view_header">
      <h1 class="help_view_title">{{ t('help.title') }}</h1>
      <p class="help_view_subtitle">{{ t('help.subtitle') }}</p>
    </header>

    <div class="help_view_body">
      <HelpTopicCard class="help_view_topic" :topic="openTopic" />

      <nav class="help_view_index" :aria-label="t('help.index')">
        <p class="help_view_index_title">{{ t('help.index') }}</p>

        <ul class="help_view_index_list">
          <li v-for="topic in HELP_TOPICS" :key="topic">
            <button
              class="help_view_index_entry"
              :class="{ help_view_index_entry_active: topic === openTopic }"
              type="button"
              :aria-current="topic === openTopic ? 'true' : undefined"
              :data-testid="`help-index-${topic}`"
              @click="openTopic = topic"
            >
              <AppIcon :name="HELP_TOPIC_ICONS[topic]" />
              <span>{{ t(`help.topics.${topic}.title`) }}</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>

<style scoped lang="scss">
.help_view {
  display: flex;
  flex-direction: column;
  gap: $space_lg;

  @include page_column(64rem);

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

  // The guide reads on the left, the index stands on the right and says where else to go.
  &_body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 15rem;
    gap: $space_lg;
    align-items: start;
  }

  &_topic {
    min-width: 0;
  }

  &_index {
    display: flex;
    flex-direction: column;
    gap: $space_sm;
    padding: $space_md;
    @include glass_surface($radius_lg);
  }

  &_index_title {
    color: var(--color_text_muted);
    font-size: 0.75em;
    font-weight: 700;
    text-transform: uppercase;
  }

  &_index_list {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    margin: 0;
    padding-left: 0;
    list-style: none;
  }

  &_index_entry {
    display: flex;
    gap: $space_sm;
    align-items: center;
    width: 100%;
    padding: $space_xs $space_sm;
    border: 0;
    border-radius: $radius_sm;
    background: none;
    color: var(--color_text_muted);
    font: inherit;
    font-size: 0.875em;
    text-align: left;
    cursor: pointer;
    transition:
      background-color $duration_fast ease,
      color $duration_fast ease;

    &:hover {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    @include focus_ring;

    &_active {
      background-color: var(--color_accent_soft);
      color: var(--color_accent);
      font-weight: 600;
    }
  }
}

// Under a narrow window the index goes on top, where it is read before the topic.
@media (max-width: 860px) {
  .help_view_body {
    grid-template-columns: minmax(0, 1fr);
  }

  .help_view_index {
    order: -1;
  }
}
</style>
