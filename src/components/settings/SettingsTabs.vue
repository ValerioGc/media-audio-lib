<script setup lang="ts">
import { computed, ref, useId } from 'vue';

export interface SettingsTab {
  id: string;
  label: string;
}

const props = defineProps<{ tabs: readonly SettingsTab[] }>();

const baseId = useId();
const activeId = ref(props.tabs[0]?.id ?? '');

const active = computed(() => props.tabs.find((tab) => tab.id === activeId.value) ?? null);

function tabId(id: string) {
  return `${baseId}-tab-${id}`;
}

function panelId(id: string) {
  return `${baseId}-panel-${id}`;
}

function select(id: string) {
  activeId.value = id;
}

/** Left/right arrows move between tabs, as expected from a tablist. */
function onKeydown(event: KeyboardEvent, index: number) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

  if (step === 0) {
    return;
  }

  event.preventDefault();
  const next = props.tabs[(index + step + props.tabs.length) % props.tabs.length];

  if (next !== undefined) {
    select(next.id);
  }
}
</script>

<template>
  <div class="settings_tabs">
    <div class="settings_tabs_list" role="tablist">
      <button
        v-for="(tab, index) in tabs"
        :id="tabId(tab.id)"
        :key="tab.id"
        class="settings_tabs_tab"
        :class="{ settings_tabs_tab_active: tab.id === activeId }"
        type="button"
        role="tab"
        :aria-selected="tab.id === activeId"
        :aria-controls="panelId(tab.id)"
        :tabindex="tab.id === activeId ? 0 : -1"
        @click="select(tab.id)"
        @keydown="onKeydown($event, index)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div
      v-if="active !== null"
      :id="panelId(active.id)"
      class="settings_tabs_panel"
      role="tabpanel"
      :aria-labelledby="tabId(active.id)"
    >
      <slot :name="active.id" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings_tabs {
  display: flex;
  flex-direction: column;
  gap: $space_lg;

  &_list {
    display: flex;
    gap: $space_xs;
    // The tabs sit in the middle of the settings page, as requested.
    justify-content: center;
    padding: $space_xs;
    border: 1px solid var(--color_border);
    border-radius: $radius_lg;
    background-color: var(--color_surface_alt);
  }

  &_tab {
    padding: $space_sm $space_lg;
    border: 0;
    border-radius: $radius_md;
    background: none;
    color: var(--color_text_muted);
    font: inherit;
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
      background-color: var(--color_accent);
      color: var(--color_on_accent);

      &:hover {
        background-color: var(--color_accent_hover);
        color: var(--color_on_accent);
      }
    }
  }
}
</style>
