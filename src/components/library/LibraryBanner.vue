<script setup lang="ts">
/**
 * A line of news at the top of the library: what an import found, what a refresh noticed,
 * where an export was written.
 *
 * One shape for all of them, told apart by tone alone. The symbol and the message sit
 * together on the left, where reading starts, and the way to close it is at the right.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import type { IconName } from '@/config/icons';
import { useSettingsStore } from '@/stores/settings';

const props = withDefaults(
  defineProps<{
    tone?: 'info' | 'warning' | 'danger';
    icon?: IconName | null;
    /** A banner that reports a problem is announced; a note is not. */
    alert?: boolean;
    /**
     * Off for a banner that reports a state rather than an event: closing it would say the
     * state had ended, when all that happened is that the banner went.
     */
    dismissible?: boolean;
  }>(),
  { tone: 'info', icon: null, alert: false, dismissible: true },
);

const emit = defineEmits<{ dismiss: [] }>();

const { t } = useI18n();
const settings = useSettingsStore();

/**
 * A banner goes on its own after a while, and the bar under it shows how long is left.
 *
 * Only one that can be closed at all: a banner reporting a state stays as long as the state
 * does. The length is a setting, and zero there means it waits to be closed by hand.
 */
const autoDismissMs = computed(() => (props.dismissible ? settings.bannerDuration * 1000 : 0));

const timeoutId = ref<ReturnType<typeof setTimeout> | null>(null);

onMounted(() => {
  if (autoDismissMs.value > 0) {
    timeoutId.value = setTimeout(() => emit('dismiss'), autoDismissMs.value);
  }
});

onBeforeUnmount(() => {
  if (timeoutId.value !== null) {
    clearTimeout(timeoutId.value);
    timeoutId.value = null;
  }
});

const TONE_ICONS: Record<'info' | 'warning' | 'danger', IconName> = {
  info: 'info',
  warning: 'warning',
  danger: 'warning',
};

const icon = computed(() => props.icon ?? TONE_ICONS[props.tone]);
</script>

<template>
  <div
    class="library_banner"
    :class="`library_banner_${tone}`"
    :role="alert ? 'alert' : 'status'"
    data-testid="library-banner"
  >
    <span class="library_banner_icon" aria-hidden="true">
      <AppIcon :name="icon" />
    </span>

    <p class="library_banner_message"><slot /></p>

    <slot name="action" />

    <button
      v-if="dismissible"
      class="library_banner_dismiss"
      type="button"
      :aria-label="t('library.report.dismiss')"
      :title="t('library.report.dismiss')"
      data-testid="library-banner-dismiss"
      @click="emit('dismiss')"
    >
      <AppIcon name="close" />
    </button>

    <!-- The time left, drained along the foot of the banner. -->
    <div
      v-if="autoDismissMs > 0"
      class="library_banner_countdown"
      data-testid="library-banner-countdown"
      :style="{ animationDuration: `${autoDismissMs}ms` }"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped lang="scss">
.library_banner {
  display: flex;
  position: relative;
  gap: $space_sm;
  align-items: center;
  padding: $space_sm $space_md;
  overflow: hidden;
  border: 1px solid var(--color_border_strong);
  border-left-width: 3px;
  border-radius: $radius_md;
  background-color: var(--color_surface_alt);
  color: var(--color_text);
  font-size: 0.875em;

  &_icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    font-size: 0.85em;
  }

  // Left of the box, beside its symbol: a message centred in the width of the window reads
  // as a title rather than as something that was just reported.
  &_message {
    flex: 1;
    min-width: 0;
    text-align: left;
    overflow-wrap: anywhere;
  }

  &_dismiss {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color_text_muted);
    font: inherit;
    font-size: 0.9em;
    cursor: pointer;
    transition:
      background-color $duration_fast ease,
      color $duration_fast ease;

    &:hover {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    @include focus_ring;
  }

  &_countdown {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 3px;
    background-color: currentcolor;
    opacity: 0.55;
    transform-origin: left center;
    animation-name: library_banner_drain;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }

  &_info {
    border-left-color: var(--color_accent);

    .library_banner_icon {
      background-color: var(--color_accent_soft);
      color: var(--color_accent);
    }

    .library_banner_countdown {
      color: var(--color_accent);
    }
  }

  &_warning {
    border-color: var(--color_warning_border);
    background-color: var(--color_warning_soft);
    border-left-color: var(--color_warning);

    .library_banner_icon {
      background-color: var(--color_warning);
      color: var(--color_on_warning);
    }

    .library_banner_countdown {
      color: var(--color_warning);
    }
  }

  &_danger {
    border-color: var(--color_danger_border);
    background-color: var(--color_danger_soft);
    border-left-color: var(--color_danger);

    .library_banner_icon {
      background-color: var(--color_danger);
      color: var(--color_on_danger);
    }

    .library_banner_countdown {
      color: var(--color_danger);
    }
  }
}

@keyframes library_banner_drain {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .library_banner_countdown {
    animation: none;
  }
}
</style>
