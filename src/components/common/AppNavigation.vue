<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

const { t } = useI18n();

const links = computed(() => [
  { to: '/library', label: t('nav.library') },
  { to: '/player', label: t('nav.player') },
  { to: '/settings', label: t('nav.settings') },
]);
</script>

<template>
  <nav class="app_navigation" :aria-label="t('nav.label')">
    <RouterLink
      v-for="link in links"
      :key="link.to"
      class="app_navigation_link"
      active-class="app_navigation_link_active"
      :to="link.to"
    >
      {{ link.label }}
    </RouterLink>
  </nav>
</template>

<style scoped lang="scss">
.app_navigation {
  display: flex;
  gap: $space_xs;

  &_link {
    padding: $space_sm $space_md;
    border-radius: $radius_md;
    color: var(--color_text_muted);
    text-decoration: none;
    transition:
      background-color $duration_fast ease,
      color $duration_fast ease;

    &:hover {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    &_active {
      background-color: var(--color_accent_soft);
      color: var(--color_accent);
      font-weight: 600;
    }

    @include focus_ring;
  }
}
</style>
