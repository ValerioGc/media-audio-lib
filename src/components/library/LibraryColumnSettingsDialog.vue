<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/AppModal.vue';
import { useSettingsStore } from '@/stores/settings';
import {
  LOCKED_LEADING_TABLE_COLUMN_KEYS,
  MANDATORY_TABLE_COLUMN_KEYS,
  type TableColumnKey,
  type TableColumnSetting,
} from '@/types/settings';

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const settings = useSettingsStore();
const draggedKey = ref<TableColumnKey | null>(null);

const columns = computed(() => settings.tableColumns);

function isMandatory(key: TableColumnKey): boolean {
  return MANDATORY_TABLE_COLUMN_KEYS.includes(key as (typeof MANDATORY_TABLE_COLUMN_KEYS)[number]);
}

function isLocked(column: TableColumnSetting): boolean {
  return LOCKED_LEADING_TABLE_COLUMN_KEYS.includes(
    column.key as (typeof LOCKED_LEADING_TABLE_COLUMN_KEYS)[number],
  );
}

function setVisible(column: TableColumnSetting, event: Event) {
  void settings.setTableColumnVisible(column.key, (event.target as HTMLInputElement).checked);
}

function onDragStart(column: TableColumnSetting) {
  if (isLocked(column)) {
    return;
  }

  draggedKey.value = column.key;
}

function onDrop(target: TableColumnSetting) {
  const source = draggedKey.value;
  draggedKey.value = null;

  if (source !== null) {
    void settings.moveTableColumn(source, target.key);
  }
}
</script>

<template>
  <AppModal :open="open" :title="t('library.columnSettings.title')" wide @close="emit('close')">
    <div class="library_column_settings">
      <p class="library_column_settings_description">
        {{ t('library.columnSettings.description') }}
      </p>

      <div class="library_column_settings_list" role="list">
        <div
          v-for="column in columns"
          :key="column.key"
          class="library_column_settings_row"
          :class="{
            library_column_settings_row_dragging: draggedKey === column.key,
            library_column_settings_row_locked: isLocked(column),
          }"
          role="listitem"
          :draggable="!isLocked(column)"
          :data-testid="`column-row-${column.key}`"
          @dragstart="onDragStart(column)"
          @dragend="draggedKey = null"
          @dragover.prevent
          @drop="onDrop(column)"
        >
          <span class="library_column_settings_handle" aria-hidden="true">
            <AppIcon :name="isLocked(column) ? 'check' : 'drag'" />
          </span>

          <label class="library_column_settings_check">
            <input
              type="checkbox"
              :checked="column.visible"
              :disabled="isMandatory(column.key)"
              :data-testid="`column-visible-${column.key}`"
              @change="setVisible(column, $event)"
            />
            <span>{{ t(`library.columns.${column.key}`) }}</span>
          </label>
        </div>
      </div>
    </div>

    <template #actions>
      <AppButton @click="settings.resetTableColumns()">
        {{ t('library.columnSettings.reset') }}
      </AppButton>
      <AppButton variant="primary" @click="emit('close')">
        {{ t('library.columnSettings.close') }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.library_column_settings {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_description {
    color: var(--color_text_muted);
  }

  &_list {
    display: flex;
    flex-direction: column;
    gap: $space_sm;
  }

  &_row {
    display: grid;
    grid-template-columns: 1.5rem minmax(9rem, 1fr);
    gap: $space_md;
    align-items: center;
    padding: $space_sm;
    border: 1px solid var(--color_border);
    border-radius: $radius_md;
    background-color: var(--color_surface);

    &_dragging {
      opacity: 0.55;
    }

    &_locked {
      background-color: var(--color_surface_alt);
    }
  }

  &_handle {
    display: inline-flex;
    color: var(--color_text_muted);
    cursor: grab;
  }

  &_row_locked &_handle {
    cursor: default;
  }

  &_check {
    display: flex;
    gap: $space_sm;
    align-items: center;
    min-width: 0;
  }

  &_check {
    color: var(--color_text);

    input {
      width: 1rem;
      height: 1rem;
      accent-color: var(--color_accent);
    }
  }

  @media (max-width: 760px) {
    &_row {
      grid-template-columns: 1.5rem minmax(0, 1fr);
    }
  }
}
</style>
