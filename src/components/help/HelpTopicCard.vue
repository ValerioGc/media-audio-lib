<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import HelpFigure from '@/components/help/HelpFigure.vue';
import { HELP_TOPICS, HELP_TOPIC_ICONS, HELP_TOPIC_LAYOUTS, type HelpTopic } from '@/config/help';

const props = defineProps<{ topic: HelpTopic }>();

const emit = defineEmits<{ open: [topic: HelpTopic] }>();

const { t, tm, rt } = useI18n();

const icon = computed(() => HELP_TOPIC_ICONS[props.topic]);
const layout = computed(() => HELP_TOPIC_LAYOUTS[props.topic]);
const position = computed(() => HELP_TOPICS.indexOf(props.topic) + 1);

/** The steps are a list in the translation files, so each language sets its own length. */
const steps = computed(() =>
  (tm(`help.topics.${props.topic}.steps`) as unknown[]).map((step) => rt(step as string)),
);

/** The topics before and after this one, so the guide can be read straight through. */
const previous = computed(() => HELP_TOPICS[position.value - 2] ?? null);
const next = computed(() => HELP_TOPICS[position.value] ?? null);
</script>

<template>
  <article class="help_topic" :data-topic="topic">
    <header class="help_topic_header">
      <span class="help_topic_icon" aria-hidden="true">
        <AppIcon :name="icon" />
      </span>

      <div class="help_topic_headings">
        <p class="help_topic_position">
          {{ t('help.position', { index: position, total: HELP_TOPICS.length }) }}
        </p>
        <h2 class="help_topic_title">{{ t(`help.topics.${topic}.title`) }}</h2>
      </div>
    </header>

    <div
      class="help_topic_content"
      :class="{
        help_topic_content_overview: layout === 'overview',
        help_topic_content_flow: layout === 'flow',
        help_topic_content_reference: layout === 'reference',
        help_topic_content_settings: layout === 'settings',
        help_topic_content_safety: layout === 'safety',
      }"
    >
      <div class="help_topic_context">
        <AppIcon name="search" />
        <p>
          <span class="help_topic_label">{{ t('help.where') }}</span>
          {{ t(`help.topics.${topic}.where`) }}
        </p>
      </div>

      <HelpFigure :topic="topic" />

      <section class="help_topic_sections">
        <article v-for="(step, index) in steps" :key="index" class="help_topic_section">
          <span v-if="layout === 'flow'" class="help_topic_section_index" aria-hidden="true">
            {{ index + 1 }}
          </span>
          <p class="help_topic_section_text">{{ step }}</p>
        </article>
      </section>
    </div>

    <p class="help_topic_tip">
      <AppIcon name="info" />
      <span>
        <span class="help_topic_label">{{ t('help.tip') }}</span>
        {{ t(`help.topics.${topic}.tip`) }}
      </span>
    </p>

    <nav class="help_topic_steer" :aria-label="t('help.index')">
      <button
        v-if="previous !== null"
        class="help_topic_steer_button"
        type="button"
        data-testid="help-previous-topic"
        @click="emit('open', previous)"
      >
        <AppIcon class="help_topic_steer_previous_icon" name="next" />
        <span>{{ t(`help.topics.${previous}.title`) }}</span>
      </button>
      <span v-else />

      <button
        v-if="next !== null"
        class="help_topic_steer_button help_topic_steer_button_next"
        type="button"
        data-testid="help-next-topic"
        @click="emit('open', next)"
      >
        <span>{{ t(`help.topics.${next}.title`) }}</span>
        <AppIcon name="next" />
      </button>
    </nav>
  </article>
</template>

<style scoped lang="scss">
.help_topic {
  display: flex;
  flex-direction: column;
  gap: $space_md;
  padding: $space_lg;
  @include glass_surface($radius_lg);
  box-shadow: var(--shadow_card);

  &_header {
    display: flex;
    gap: $space_md;
    align-items: center;
    padding-bottom: $space_md;
    border-bottom: 1px solid var(--color_border);
  }

  &_icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: $radius_lg;
    background-color: var(--color_accent_soft);
    color: var(--color_accent);
    font-size: 1.25em;
  }

  &_headings {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    min-width: 0;
  }

  &_position {
    color: var(--color_text_muted);
    font-size: 0.6875em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &_title {
    font-size: 1.25em;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  &_content {
    display: flex;
    flex-direction: column;
    gap: $space_lg;
  }

  &_context {
    display: flex;
    gap: $space_sm;
    align-items: flex-start;
    padding: $space_sm $space_md;
    border-left: 3px solid var(--color_accent);
    border-radius: $radius_sm;
    background-color: var(--color_surface_alt);
    color: var(--color_text_muted);
    font-size: 0.9375em;

    :deep(.app_icon) {
      flex-shrink: 0;
      color: var(--color_accent);
    }

    p {
      min-width: 0;
    }
  }

  &_label {
    margin-right: $space_xs;
    color: var(--color_text);
    font-weight: 600;
  }

  &_sections {
    display: flex;
    flex-wrap: wrap;
    gap: $space_md;
    margin: 0;
  }

  &_section {
    flex: 1 1 100%;
    min-width: 0;
    padding: $space_md;
    border: 1px solid var(--color_border);
    border-radius: $radius_md;
    background-color: var(--color_surface_alt);
  }

  &_section_text {
    margin: 0;
  }

  &_section_index {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    margin-bottom: $space_sm;
    border-radius: 50%;
    background-color: var(--color_accent_soft);
    color: var(--color_accent);
    font-size: 0.75em;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  &_content_overview &_sections,
  &_content_reference &_sections {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  &_content_overview &_section:first-child {
    grid-column: 1 / -1;
    border-color: var(--color_accent);
    background-color: var(--color_accent_soft);
  }

  &_content_flow &_section {
    border-left: 3px solid var(--color_accent);
  }

  &_content_settings &_section {
    padding: $space_sm 0;
    border-width: 0 0 1px;
    border-radius: 0;
    background: none;
  }

  &_content_safety &_section {
    border-color: var(--color_warning_border);
    background-color: var(--color_warning_soft);
  }

  // The one thing worth knowing that is not a step: set apart so it is not read as one.
  &_tip {
    display: flex;
    gap: $space_sm;
    align-items: baseline;
    padding: $space_sm $space_md;
    border-left: 3px solid var(--color_accent);
    border-radius: $radius_sm;
    background-color: var(--color_accent_soft);
    font-size: 0.9375em;
  }

  &_steer {
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
    padding-top: $space_md;
    border-top: 1px solid var(--color_border);

    &_previous_icon {
      transform: rotate(180deg);
    }

    &_button {
      display: inline-flex;
      gap: $space_xs;
      align-items: center;
      max-width: 48%;
      padding: $space_xs $space_sm;
      border: 1px solid var(--color_border);
      border-radius: 999px;
      background: none;
      color: var(--color_text_muted);
      font: inherit;
      font-size: 0.8125em;
      cursor: pointer;
      transition:
        border-color $duration_fast ease,
        background-color $duration_fast ease,
        color $duration_fast ease;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      &:hover {
        border-color: var(--color_accent);
        background-color: var(--color_accent_soft);
        color: var(--color_accent);
      }

      @include focus_ring;

      &_next {
        margin-left: auto;
      }
    }
  }
}
</style>
