<script setup lang="ts">
import { useId } from 'vue';

import { GENRES } from '@/config/genres';

defineProps<{
  modelValue: string;
  label: string;
  customLabel: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const selectId = useId();
const listId = useId();

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="genre_select">
    <label class="genre_select_label" :for="selectId">{{ label }}</label>
    <!-- A datalist keeps the predefined list while still accepting a custom genre. -->
    <input
      :id="selectId"
      class="genre_select_input"
      :list="listId"
      :value="modelValue"
      :placeholder="customLabel"
      @input="onInput"
    />
    <datalist :id="listId">
      <option v-for="genre in GENRES" :key="genre" :value="genre" />
    </datalist>
  </div>
</template>

<style scoped lang="scss">
.genre_select {
  display: flex;
  flex-direction: column;
  gap: $space_xs;

  &_label {
    font-size: 0.875em;
    color: var(--color_text_muted);
  }

  &_input {
    min-height: 2rem;
    padding: $space_sm $space_md;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_md;
    background-color: var(--color_surface);
    color: var(--color_text);
    font: inherit;

    &:focus-visible {
      outline: 2px solid var(--color_accent);
      outline-offset: 1px;
    }
  }
}
</style>
