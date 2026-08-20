<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';

export type TooltipPlacement = 'top' | 'bottom';
export type TooltipAlign = 'start' | 'center' | 'end';

const props = withDefaults(
  defineProps<{
    text: string;
    /** `bottom` for controls sitting against the top edge of the window. */
    placement?: TooltipPlacement;
    align?: TooltipAlign;
  }>(),
  { placement: 'top', align: 'end' },
);

/** Distance between the bubble and its trigger, and margin kept from the window edges. */
const GAP_PX = 6;

const isVisible = ref(false);
const anchor = ref<HTMLElement | null>(null);
const bubble = ref<HTMLElement | null>(null);
const resolvedPlacement = ref<TooltipPlacement>(props.placement);
const position = ref({ top: 0, left: 0 });

function horizontalPosition(trigger: DOMRect, width: number): number {
  if (props.align === 'start') {
    return trigger.left;
  }

  if (props.align === 'end') {
    return trigger.right - width;
  }

  return trigger.left + trigger.width / 2 - width / 2;
}

/**
 * The bubble is placed against the window rather than against its trigger: several of the
 * controls that carry one live inside panels that clip their overflow, and an absolutely
 * positioned bubble would be cut off by them.
 */
function place() {
  const trigger = anchor.value;
  const box = bubble.value;

  if (trigger === null || box === null) {
    return;
  }

  const rect = trigger.getBoundingClientRect();
  const { width, height } = box.getBoundingClientRect();

  const above = rect.top - height - GAP_PX;
  const below = rect.bottom + GAP_PX;
  const fitsAbove = above >= GAP_PX;
  const fitsBelow = below + height <= window.innerHeight - GAP_PX;

  // The requested side wins whenever it fits, otherwise the bubble flips over.
  const useTop = props.placement === 'top' ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;

  resolvedPlacement.value = useTop ? 'top' : 'bottom';
  position.value = {
    top: useTop ? above : below,
    left: Math.min(
      Math.max(GAP_PX, horizontalPosition(rect, width)),
      Math.max(GAP_PX, window.innerWidth - width - GAP_PX),
    ),
  };
}

function hide() {
  isVisible.value = false;
  window.removeEventListener('scroll', hide, true);
  window.removeEventListener('resize', hide);
}

async function show() {
  isVisible.value = true;
  // Scrolling or resizing moves the trigger away from a bubble already on screen.
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);

  await nextTick();
  place();
}

onBeforeUnmount(hide);
</script>

<template>
  <span
    ref="anchor"
    class="app_tooltip"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
    <Teleport to="body">
      <span
        v-if="isVisible"
        ref="bubble"
        class="app_tooltip_bubble"
        role="tooltip"
        :data-placement="resolvedPlacement"
        :style="{ top: `${position.top}px`, left: `${position.left}px` }"
        >{{ text }}</span
      >
    </Teleport>
  </span>
</template>

<style lang="scss">
.app_tooltip {
  position: relative;
  display: inline-flex;
}

// Not scoped: the bubble is rendered on the body, outside this component's subtree.
.app_tooltip_bubble {
  position: fixed;
  z-index: 100;
  padding: $space_xs $space_sm;
  @include surface_panel($radius_sm);
  box-shadow: var(--shadow_raised);
  color: var(--color_text);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
}
</style>
