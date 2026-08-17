<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView } from 'vue-router';

import AppNavigation from '@/components/common/AppNavigation.vue';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();

onMounted(() => {
  void settings.initialize();
});

onBeforeUnmount(() => {
  settings.dispose();
});
</script>

<template>
  <div class="app_shell">
    <header class="app_shell_header">
      <span class="app_shell_brand">{{ t('app.name') }}</span>
      <AppNavigation />
    </header>
    <main class="app_shell_content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped lang="scss">
.app_shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100%;

  &_header {
    display: flex;
    gap: $space_lg;
    align-items: center;
    padding: $space_sm $space_lg;
    border-bottom: 1px solid var(--color_border);
    background-color: var(--color_surface);
  }

  &_brand {
    font-weight: 600;
  }

  &_content {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: $space_lg;
    overflow-y: auto;
  }
}
</style>
