<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppMenu from '@/components/common/AppMenu.vue';
import type { TrackView } from '@/types/library';
import type { MenuItem } from '@/types/menu';

const props = defineProps<{
  track: TrackView;
}>();

const emit = defineEmits<{
  edit: [track: TrackView];
  remove: [track: TrackView];
  verify: [track: TrackView];
}>();

const { t } = useI18n();
const menu = ref<InstanceType<typeof AppMenu> | null>(null);

/** Short labels on screen, the full sentence only for screen readers. */
const items = computed<MenuItem[]>(() => [
  {
    id: 'edit',
    label: t('library.row.menu.edit'),
    description: t('library.row.edit', { title: props.track.title }),
    icon: 'edit',
    disabled: props.track.missing,
  },
  {
    id: 'verify',
    label: t('library.row.menu.verify'),
    description: t('library.row.verify', { title: props.track.title }),
    icon: 'verify',
  },
  {
    id: 'remove',
    label: t('library.row.menu.remove'),
    description: t('library.row.remove', { title: props.track.title }),
    icon: 'remove',
    danger: true,
  },
]);

function run(id: string) {
  if (id === 'edit') {
    emit('edit', props.track);
  } else if (id === 'verify') {
    emit('verify', props.track);
  } else {
    emit('remove', props.track);
  }
}

function openMenu() {
  void menu.value?.open();
}

defineExpose({ open: openMenu });
</script>

<template>
  <div class="library_row_menu" @click.stop @dblclick.stop>
    <AppMenu
      ref="menu"
      :items="items"
      :label="t('library.row.actions', { title: track.title })"
      @select="run"
    />
  </div>
</template>

<style scoped lang="scss">
.library_row_menu {
  display: flex;
  justify-content: flex-end;
}
</style>
