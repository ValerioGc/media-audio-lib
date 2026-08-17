<script setup lang="ts">
import { useId } from 'vue';

import type { SelectOption } from '@/types/ui';

defineProps<{
  modelValue: string;
  options: readonly SelectOption[];
  legend: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const groupName = useId();
</script>

<template>
  <fieldset class="app_option_group">
    <legend class="app_option_group_legend">{{ legend }}</legend>
    <div class="app_option_group_items">
      <label
        v-for="option in options"
        :key="option.value"
        class="app_option_group_item"
        :class="{ app_option_group_item_selected: option.value === modelValue }"
      >
        <input
          class="app_option_group_input"
          type="radio"
          :name="groupName"
          :value="option.value"
          :checked="option.value === modelValue"
          @change="emit('update:modelValue', option.value)"
        />
        <span class="app_option_group_text">{{ option.label }}</span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped lang="scss">
.app_option_group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;

  &_legend {
    padding: 0 0 $space_xs;
    font-size: 0.875em;
    color: var(--color_text_muted);
  }

  &_items {
    display: flex;
    flex-wrap: wrap;
    gap: $space_xs;
    padding: $space_xs;
    border: 1px solid var(--color_border);
    border-radius: $radius_lg;
    background-color: var(--color_surface_alt);
  }

  &_item {
    padding: $space_sm $space_md;
    border-radius: $radius_md;
    cursor: pointer;
    transition:
      background-color $duration_fast ease,
      color $duration_fast ease;

    &:hover {
      background-color: var(--color_surface_hover);
    }

    &_selected {
      background-color: var(--color_accent);
      color: var(--color_on_accent);

      &:hover {
        background-color: var(--color_accent_hover);
      }
    }

    &:focus-within {
      outline: 2px solid var(--color_accent);
      outline-offset: 1px;
    }
  }

  &_input {
    @include visually_hidden;
  }
}
</style>
