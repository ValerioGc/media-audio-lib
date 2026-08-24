<script setup lang="ts">
import { useId, watch } from 'vue';

import { useOverlay } from '@/composables/useForeground';

const props = defineProps<{
  open: boolean;
  title: string;
  wide?: boolean;
  /** Translucent panel, and the background of the window painted through it. */
  glass?: boolean;
  /**
   * For a dialog whose content scrolls itself — a list, a table. The body stops being a
   * scrolling box of its own, so the panel shows one scrollbar instead of two side by side.
   */
  contentScrolls?: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const titleId = useId();

// The page is behind this panel while it is open, so anything counted down out there stops.
useOverlay(() => props.open);

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close');
  }
}

// The listener only exists while the dialog is on screen.
watch(
  () => props.open,
  (isOpen) => {
    if (typeof document === 'undefined') {
      return;
    }

    if (isOpen) {
      document.addEventListener('keydown', onKeydown);
    } else {
      document.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true },
);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="app_modal" @click.self="emit('close')">
      <dialog
        open
        class="app_modal_panel"
        :class="{ app_modal_panel_wide: wide, app_modal_panel_glass: glass }"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <h2 :id="titleId" class="app_modal_title">{{ title }}</h2>
        <div class="app_modal_body" :class="{ app_modal_body_content_scrolls: contentScrolls }">
          <slot />
        </div>
        <footer class="app_modal_actions">
          <slot name="actions" />
        </footer>
      </dialog>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.app_modal {
  position: fixed;
  inset: 0;
  // Over everything it can be opened from: the full player covers the window at 20.
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $space_lg;
  background-color: rgb(0 0 0 / 40%);

  &_panel {
    // The browser lays a dialog out absolutely, pinned to the left of its backdrop: static
    // puts it back in the flow, where the backdrop centres it like any other panel.
    position: static;
    display: flex;
    flex-direction: column;
    gap: $space_md;
    width: min(28rem, 100%);
    max-height: 100%;
    padding: $space_lg;
    margin: 0;
    color: var(--color_text);
    @include surface_panel($radius_lg);
    box-shadow: var(--shadow_raised);

    &_wide {
      width: min(62rem, 100%);
    }

    // Translucent and blurred, following the glass setting: with it off the tokens hold a
    // plain surface and the panel looks like any other.
    &_glass {
      @include glass_surface($radius_lg);

      box-shadow: var(--shadow_raised);
    }

    // The gradient of the window, painted through the glass. It follows the two settings
    // that already draw it, so a panel never carries a background the window is without.
    :root[data-ambient='on'][data-ambient-panels='on'] &_glass {
      background-image: var(--app_ambient_layers);
      background-repeat: no-repeat;
    }
  }

  &_title {
    font-size: 1.125em;
    font-weight: 600;
  }

  // A column rather than a block: content that scrolls on its own — a list, a table — gets
  // a bounded height to do it in, instead of pushing the whole dialog to scroll.
  &_body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    color: var(--color_text_muted);

    @include scroll_area;

    &_content_scrolls {
      overflow: visible;
      scrollbar-gutter: auto;
    }
  }

  &_actions {
    display: flex;
    gap: $space_sm;
    justify-content: flex-end;
  }
}
</style>
