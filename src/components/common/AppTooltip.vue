<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ text: string }>();

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
    <span v-if="isVisible" class="app_tooltip_bubble" role="tooltip">{{ text }}</span>
  </span>
</template>

<style scoped lang="scss">
.app_tooltip {
  position: relative;
  display: inline-flex;

  &_bubble {
    position: absolute;
    right: 0;
    bottom: calc(100% + #{$space_xs});
    z-index: 5;
    padding: $space_xs $space_sm;
    @include surface_panel($radius_sm);
    box-shadow: var(--shadow_raised);
    color: var(--color_text);
    font-size: 0.75rem;
    white-space: nowrap;
    pointer-events: none;
  }
}
</style>
