<script setup lang="ts">
import { computed } from 'vue';

import { APP_NAME, APP_VERSION, isTauriRuntime } from '@/config/app-config';

const runtimeLabel = computed(() => (isTauriRuntime() ? 'Tauri' : 'Browser'));
</script>

<template>
  <main class="app_shell">
    <h1 class="app_shell_title">{{ APP_NAME }}</h1>
    <p class="app_shell_meta">
      <span class="app_shell_version">v{{ APP_VERSION }}</span>
      <span class="app_shell_runtime" data-testid="runtime">{{ runtimeLabel }}</span>
    </p>
    <p class="app_shell_hint">
    </p>
  </main>
</template>

<style scoped lang="scss">
.app_shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $space_sm;
  align-items: center;
  justify-content: center;
  padding: $space_xl;
  text-align: center;

  &_title {
    margin: 0;
    font-size: 2rem;
    font-weight: 600;
  }

  &_meta {
    display: flex;
    gap: $space_sm;
    margin: 0;
    opacity: 0.7;
  }

  &_runtime {
    padding: 0 $space_sm;
    border-radius: $radius_sm;
    background-color: rgb(128 128 128 / 20%);
  }

  &_hint {
    margin: 0;
    opacity: 0.6;
  }
}
</style>
