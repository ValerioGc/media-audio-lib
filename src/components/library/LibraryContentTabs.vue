<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { LIBRARY_CONTENT_TABS, type LibraryContentTab } from '@/types/library';

const props = defineProps<{
  modelValue: LibraryContentTab;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: LibraryContentTab];
}>();

const { t } = useI18n();

const list = ref<HTMLElement | null>(null);
const buttons = ref<HTMLButtonElement[]>([]);
const indicator = ref({ left: 0, width: 0, ready: false });

let observer: ResizeObserver | null = null;

function collect(element: unknown, index: number) {
  buttons.value[index] = element as HTMLButtonElement;
}

/**
 * Places the underline under the selected tab. Measured rather than styled per tab so the
 * bar slides between the sections instead of blinking from one to the next.
 */
function measureIndicator() {
  const index = LIBRARY_CONTENT_TABS.indexOf(props.modelValue);
  const button = buttons.value[index];

  if (button === undefined || button.offsetWidth === 0) {
    indicator.value = { ...indicator.value, ready: false };
    return;
  }

  indicator.value = { left: button.offsetLeft, width: button.offsetWidth, ready: true };
}

function select(tab: LibraryContentTab) {
  emit('update:modelValue', tab);
}

/** Arrow keys move between the sections, as expected from a tablist. */
function onKeydown(event: KeyboardEvent, index: number) {
  const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
  const offset = offsets[event.key];

  let target: number | null = null;

  if (offset !== undefined) {
    target = (index + offset + LIBRARY_CONTENT_TABS.length) % LIBRARY_CONTENT_TABS.length;
  } else if (event.key === 'Home') {
    target = 0;
  } else if (event.key === 'End') {
    target = LIBRARY_CONTENT_TABS.length - 1;
  }

  if (target === null) {
    return;
  }

  event.preventDefault();
  select(LIBRARY_CONTENT_TABS[target]!);
  void nextTick(() => buttons.value[target]?.focus());
}

watch(
  () => props.modelValue,
  () => void nextTick(measureIndicator),
);

onMounted(() => {
  measureIndicator();

  // The bar follows the tabs when the window, the text size or the language changes.
  if (typeof ResizeObserver !== 'undefined' && list.value !== null) {
    observer = new ResizeObserver(() => measureIndicator());
    observer.observe(list.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <div
    ref="list"
    class="library_content_tabs"
    role="tablist"
    :aria-label="t('library.tabs.label')"
  >
    <button
      v-for="(tab, index) in LIBRARY_CONTENT_TABS"
      :id="`library-tab-${tab}`"
      :key="tab"
      :ref="(element) => collect(element, index)"
      class="library_content_tabs_tab"
      :class="{ library_content_tabs_tab_active: tab === modelValue }"
      type="button"
      role="tab"
      :aria-selected="tab === modelValue"
      :aria-controls="`library-panel-${tab}`"
      :tabindex="tab === modelValue ? 0 : -1"
      @click="select(tab)"
      @keydown="onKeydown($event, index)"
    >
      {{ t(`library.tabs.${tab}`) }}
    </button>

    <span
      v-show="indicator.ready"
      class="library_content_tabs_indicator"
      aria-hidden="true"
      :style="{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }"
    />
  </div>
</template>

<style scoped lang="scss">
.library_content_tabs {
  display: flex;
  position: relative;
  gap: $space_sm;
  align-items: center;
  flex-shrink: 0;
  padding-bottom: $space_sm;

  // The rail the indicator runs on, drawn under the whole strip.
  &::after {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 1px;
    background-color: var(--color_border);
    content: '';
  }

  &_tab {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;
    min-height: 2rem;
    padding: $space_xs $space_sm;
    border: 0;
    border-radius: $radius_sm;
    background-color: transparent;
    color: var(--color_text_muted);
    font: inherit;
    font-size: 1.0625em;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: color $duration_fast ease;

    @include focus_ring;

    &:hover {
      color: var(--color_text);
    }

    &_active {
      color: var(--color_accent);
      font-weight: 600;
    }
  }

  &_indicator {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    border-radius: 999px;
    background-color: var(--color_accent);
    transition:
      transform $duration_base cubic-bezier(0.2, 0, 0, 1),
      width $duration_base cubic-bezier(0.2, 0, 0, 1);
    will-change: transform, width;
  }
}
</style>
