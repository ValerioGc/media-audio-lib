<script setup lang="ts">
import { ref } from 'vue';

export type TooltipPlacement = 'top' | 'bottom';
export type TooltipAlign = 'start' | 'center' | 'end';

withDefaults(
  defineProps<{
    text: string;
    /** `bottom` for controls sitting against the top edge of the window. */
    placement?: TooltipPlacement;
    align?: TooltipAlign;
  }>(),
  { placement: 'top', align: 'end' },
);

const isVisible = ref(false);

function show() {
  isVisible.value = true;
}

function hide() {
  isVisible.value = false;
}
</script>

<template>
  <span class="app_tooltip" @mouseenter="show" @mouseleave="hide" @focusin="show" @focusout="hide">
    <slot />
    <span
      v-if="isVisible"
      class="app_tooltip_bubble"
      :class="[`app_tooltip_bubble_${placement}`, `app_tooltip_bubble_${align}`]"
      role="tooltip"
      >{{ text }}</span
    >
  </span>
</template>

<style scoped lang="scss">
.app_tooltip {
  position: relative;
  display: inline-flex;

  &_bubble {
    position: absolute;
    z-index: 5;
    padding: $space_xs $space_sm;
    @include surface_panel($radius_sm);
    box-shadow: var(--shadow_raised);
    color: var(--color_text);
    font-size: 0.75rem;
    font-weight: 400;
    white-space: nowrap;
    pointer-events: none;

    &_top {
      bottom: calc(100% + #{$space_xs});
    }

    &_bottom {
      top: calc(100% + #{$space_xs});
    }

    &_start {
      left: 0;
    }

    &_center {
      left: 50%;
      transform: translateX(-50%);
    }

    &_end {
      right: 0;
    }
  }
}
</style>
