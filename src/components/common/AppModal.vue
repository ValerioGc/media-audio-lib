<script setup lang="ts">
import { useId, watch } from 'vue';

const props = defineProps<{
  open: boolean;
  title: string;
  wide?: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const titleId = useId();

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
        :class="{ app_modal_panel_wide: wide }"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <h2 :id="titleId" class="app_modal_title">{{ title }}</h2>
        <div class="app_modal_body">
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
  z-index: 10;
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
  }

  &_title {
    font-size: 1.125em;
    font-weight: 600;
  }

  &_body {
    min-height: 0;
    color: var(--color_text_muted);

    @include scroll_area;
  }

  &_actions {
    display: flex;
    gap: $space_sm;
    justify-content: flex-end;
  }
}
</style>
