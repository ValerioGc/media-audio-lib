<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <section class="settings_section">
    <header class="settings_section_header">
      <h2 class="settings_section_title">{{ title }}</h2>
      <p class="settings_section_description">{{ description }}</p>
    </header>
    <div class="settings_section_body">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.settings_section {
  display: flex;
  flex-direction: column;
  gap: $space_md;
  padding: $space_lg;
  @include surface_panel($radius_lg);
  box-shadow: var(--shadow_card);

  &_header {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
  }

  &_title {
    font-size: 1.125em;
    font-weight: 600;
  }

  &_description {
    color: var(--color_text_muted);
  }
}
</style>
