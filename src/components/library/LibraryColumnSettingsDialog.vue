<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/AppModal.vue';
import { useSettingsStore } from '@/stores/settings';
import {
  MANDATORY_TABLE_COLUMN_KEYS,
  TABLE_COLUMN_WIDTHS,
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

function positionOf(key: TableColumnKey): number {
  return columns.value.findIndex((column) => column.key === key);
}

function canMove(column: TableColumnSetting, direction: -1 | 1): boolean {
  return columns.value[positionOf(column.key) + direction] !== undefined;
}

function setVisible(column: TableColumnSetting, event: Event) {
  void settings.setTableColumnVisible(column.key, (event.target as HTMLInputElement).checked);
}

function setWidth(column: TableColumnSetting, event: Event) {
  void settings.setTableColumnWidth(column.key, Number((event.target as HTMLInputElement).value));
}

function nudge(column: TableColumnSetting, direction: -1 | 1) {
  void settings.nudgeTableColumn(column.key, direction);
}

function onDragStart(column: TableColumnSetting) {
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
          :class="{ library_column_settings_row_dragging: draggedKey === column.key }"
          role="listitem"
          draggable="true"
          :data-testid="`column-row-${column.key}`"
          @dragstart="onDragStart(column)"
          @dragend="draggedKey = null"
          @dragover.prevent
          @drop="onDrop(column)"
        >
          <span class="library_column_settings_handle" aria-hidden="true">⋮⋮</span>

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

          <label class="library_column_settings_width">
            <span>{{ t('library.columnSettings.width') }}</span>
            <input
              type="range"
              :min="TABLE_COLUMN_WIDTHS[column.key].min"
              :max="TABLE_COLUMN_WIDTHS[column.key].max"
              step="4"
              :value="column.width"
              :data-testid="`column-width-${column.key}`"
              @input="setWidth(column, $event)"
            />
            <strong>{{ column.width }}px</strong>
          </label>

          <div class="library_column_settings_move">
            <AppButton
              variant="ghost"
              :disabled="!canMove(column, -1)"
              :aria-label="
                t('library.columnSettings.moveUp', { column: t(`library.columns.${column.key}`) })
              "
              :data-testid="`column-up-${column.key}`"
              @click="nudge(column, -1)"
            >
              <AppIcon name="expand" />
            </AppButton>
            <AppButton
              variant="ghost"
              :disabled="!canMove(column, 1)"
              :aria-label="
                t('library.columnSettings.moveDown', { column: t(`library.columns.${column.key}`) })
              "
              :data-testid="`column-down-${column.key}`"
              @click="nudge(column, 1)"
            >
              <AppIcon name="collapse" />
            </AppButton>
          </div>
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
    grid-template-columns: 1.5rem minmax(9rem, 1fr) minmax(12rem, 1.2fr) auto;
    gap: $space_md;
    align-items: center;
    padding: $space_sm;
    border: 1px solid var(--color_border);
    border-radius: $radius_md;
    background-color: var(--color_surface);

    &_dragging {
      opacity: 0.55;
    }
  }

  &_handle {
    color: var(--color_text_muted);
    cursor: grab;
  }

  &_check,
  &_width {
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

  &_width {
    span {
      color: var(--color_text_muted);
      font-size: 0.875em;
    }

    input {
      flex: 1;
      accent-color: var(--color_accent);
    }

    strong {
      min-width: 4rem;
      font-size: 0.875em;
      text-align: right;
    }
  }

  &_move {
    display: flex;
    gap: $space_xs;
  }

  @media (max-width: 760px) {
    &_row {
      grid-template-columns: 1.5rem minmax(0, 1fr) auto;
    }

    &_width {
      grid-column: 2 / -1;
    }
  }
}
</style>
