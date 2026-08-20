<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/AppModal.vue';
import { fittedTableColumnWidths } from '@/services/table-columns';
import { useLibraryStore } from '@/stores/library';
import { useSettingsStore } from '@/stores/settings';
import {
  LOCKED_LEADING_TABLE_COLUMN_KEYS,
  MANDATORY_TABLE_COLUMN_KEYS,
  TABLE_COLUMN_KEYS,
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
const library = useLibraryStore();
const settings = useSettingsStore();
const draggedKey = ref<TableColumnKey | null>(null);

const columns = computed(() => settings.tableColumns);
const columnLabels = computed<Record<TableColumnKey, string>>(
  () =>
    Object.fromEntries(
      TABLE_COLUMN_KEYS.map((key) => [key, t(`library.columns.${key}`)]),
    ) as Record<TableColumnKey, string>,
);

function isMandatory(key: TableColumnKey): boolean {
  return MANDATORY_TABLE_COLUMN_KEYS.includes(key as (typeof MANDATORY_TABLE_COLUMN_KEYS)[number]);
}

function isLocked(column: TableColumnSetting): boolean {
  return LOCKED_LEADING_TABLE_COLUMN_KEYS.includes(
    column.key as (typeof LOCKED_LEADING_TABLE_COLUMN_KEYS)[number],
  );
}

function isTableColumnKey(value: string): value is TableColumnKey {
  return TABLE_COLUMN_KEYS.includes(value as TableColumnKey);
}

async function setVisible(column: TableColumnSetting, event: Event) {
  await settings.setTableColumnVisible(column.key, (event.target as HTMLInputElement).checked);
}

function canMove(column: TableColumnSetting, direction: -1 | 1): boolean {
  if (isLocked(column)) {
    return false;
  }

  const index = columns.value.findIndex((item) => item.key === column.key);
  const target = columns.value[index + direction];

  return target !== undefined && !isLocked(target);
}

async function moveColumn(column: TableColumnSetting, direction: -1 | 1) {
  if (canMove(column, direction)) {
    await settings.nudgeTableColumn(column.key, direction);
  }
}

async function fitColumnsToContent() {
  await settings.setTableColumnWidths(
    fittedTableColumnWidths(settings.tableColumns, library.visibleTracks, columnLabels.value),
  );
}

function onDragStart(event: DragEvent, column: TableColumnSetting) {
  if (isLocked(column)) {
    return;
  }

  event.dataTransfer?.setData('text/plain', column.key);

  if (event.dataTransfer !== null) {
    event.dataTransfer.effectAllowed = 'move';
  }

  draggedKey.value = column.key;
}

async function onDrop(event: DragEvent, target: TableColumnSetting) {
  event.preventDefault();
  const source = draggedKey.value ?? event.dataTransfer?.getData('text/plain') ?? '';
  draggedKey.value = null;

  if (isTableColumnKey(source) && source !== target.key) {
    await settings.moveTableColumn(source, target.key);
  }
}
</script>

<template>
  <AppModal :open="open" :title="t('library.columnSettings.title')" wide @close="emit('close')">
    <div class="library_column_settings">
      <p class="library_column_settings_description">
        {{ t('library.columnSettings.description') }}
      </p>

      <button
        class="library_column_settings_fit"
        type="button"
        data-testid="column-fit"
        @click="fitColumnsToContent"
      >
        <AppIcon name="maximize" />
        <span>{{ t('library.columnSettings.fit') }}</span>
      </button>

      <ul class="library_column_settings_list">
        <li
          v-for="column in columns"
          :key="column.key"
          class="library_column_settings_row"
          :class="{
            library_column_settings_row_dragging: draggedKey === column.key,
            library_column_settings_row_locked: isLocked(column),
          }"
          :draggable="!isLocked(column)"
          :data-testid="`column-row-${column.key}`"
          @dragstart="onDragStart($event, column)"
          @dragend="draggedKey = null"
          @dragover.prevent
          @drop="onDrop($event, column)"
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

          <div class="library_column_settings_order">
            <button
              class="library_column_settings_order_button"
              type="button"
              :aria-label="
                t('library.columnSettings.moveUp', { column: t(`library.columns.${column.key}`) })
              "
              :title="
                t('library.columnSettings.moveUp', { column: t(`library.columns.${column.key}`) })
              "
              :disabled="!canMove(column, -1)"
              :data-testid="`column-move-up-${column.key}`"
              @click="moveColumn(column, -1)"
            >
              <AppIcon name="sortAsc" />
            </button>
            <button
              class="library_column_settings_order_button"
              type="button"
              :aria-label="
                t('library.columnSettings.moveDown', {
                  column: t(`library.columns.${column.key}`),
                })
              "
              :title="
                t('library.columnSettings.moveDown', {
                  column: t(`library.columns.${column.key}`),
                })
              "
              :disabled="!canMove(column, 1)"
              :data-testid="`column-move-down-${column.key}`"
              @click="moveColumn(column, 1)"
            >
              <AppIcon name="sortDesc" />
            </button>
          </div>
        </li>
      </ul>
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

  &_fit {
    display: inline-flex;
    gap: $space_sm;
    align-self: flex-start;
    align-items: center;
    min-height: 2rem;
    padding: $space_xs $space_md;
    border: 1px solid var(--color_border);
    border-radius: $radius_sm;
    background-color: var(--color_surface);
    color: var(--color_text);
    font: inherit;
    cursor: pointer;

    &:hover {
      background-color: var(--color_surface_hover);
    }

    @include focus_ring;
  }

  &_list {
    display: flex;
    flex-direction: column;
    gap: $space_sm;
    max-height: min(22rem, 46vh);
    margin: 0;
    padding-right: $space_xs;
    padding-left: 0;
    list-style: none;

    @include scroll_area;
  }

  &_row {
    display: grid;
    grid-template-columns: 1.5rem minmax(9rem, 1fr) auto;
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
    color: var(--color_text);

    input {
      width: 1rem;
      height: 1rem;
      accent-color: var(--color_accent);
    }
  }

  &_order {
    display: inline-flex;
    gap: $space_2xs;
  }

  &_order_button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--color_border);
    border-radius: $radius_sm;
    background-color: var(--color_surface_alt);
    color: var(--color_text_muted);
    cursor: pointer;

    &:hover:not(:disabled) {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    @include focus_ring;
  }

  @media (max-width: 760px) {
    &_row {
      grid-template-columns: 1.5rem minmax(0, 1fr) auto;
    }
  }
}
</style>
