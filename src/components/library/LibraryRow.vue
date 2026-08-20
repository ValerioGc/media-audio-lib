<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import LibraryCoverCell from '@/components/library/LibraryCoverCell.vue';
import LibraryRowActions from '@/components/library/LibraryRowActions.vue';
import { PLAYING_LABEL_MIN_TITLE_WIDTH_PX } from '@/config/layout';
import { tableColumnValue } from '@/services/table-columns';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { TrackSelectionIntent, TrackView } from '@/types/library';
import { TABLE_COLUMN_WIDTHS, type TableColumnSetting } from '@/types/settings';

const props = defineProps<{
  track: TrackView;
  columns?: readonly TableColumnSetting[];
  selected: boolean;
  playing: boolean;
}>();

const emit = defineEmits<{
  select: [intent: TrackSelectionIntent];
  play: [track: TrackView];
  edit: [track: TrackView];
  remove: [track: TrackView];
  verify: [track: TrackView];
}>();

const { t } = useI18n();
const player = usePlayerStore();
const settings = useSettingsStore();
const actions = ref<InstanceType<typeof LibraryRowActions> | null>(null);

const accentStyle = computed(() =>
  props.playing && settings.coverGradientEnabled && player.coverAccent !== null
    ? { '--cover_row_gradient': player.coverAccent.rowGradient }
    : {},
);

const columns = computed(
  () => props.columns ?? settings.tableColumns.filter((column) => column.visible),
);

const showsPlayingLabel = computed(() => {
  const title = columns.value.find((column) => column.key === 'title');

  return (title?.width ?? TABLE_COLUMN_WIDTHS.title.default) >= PLAYING_LABEL_MIN_TITLE_WIDTH_PX;
});

function valueFor(column: TableColumnSetting): string {
  return tableColumnValue(
    props.track,
    column.key,
    t('library.row.unknown'),
    t('library.row.missingShort'),
    t('library.row.present'),
  );
}

function select(event: MouseEvent | KeyboardEvent) {
  emit('select', {
    id: props.track.id,
    additive: event instanceof MouseEvent && (event.ctrlKey || event.metaKey),
    range: event.shiftKey,
  });
}

function openActionsMenu(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  actions.value?.open();
}
</script>

<template>
  <div
    class="library_row"
    :class="{
      library_row_selected: selected,
      library_row_missing: track.missing,
      library_row_playing: playing,
    }"
    :style="accentStyle"
    role="row"
    tabindex="0"
    :aria-selected="selected"
    :aria-current="playing ? 'true' : undefined"
    @click="select($event)"
    @contextmenu="openActionsMenu"
    @dblclick="emit('play', track)"
    @keydown.enter="select($event)"
  >
    <span
      v-for="column in columns"
      :key="column.key"
      class="library_row_cell"
      :class="{ library_row_cover: column.key === 'cover' }"
      role="cell"
    >
      <LibraryCoverCell v-if="column.key === 'cover'" :track="track" />
      <template v-else-if="column.key === 'title'">
        <span class="library_row_title">
          <!-- Columns are narrow and resizable: the full value is one hover away. -->
          <span class="library_row_text" :title="track.title">{{ track.title }}</span>
          <span
            v-if="playing"
            class="library_row_badge library_row_badge_playing"
            :class="{ library_row_badge_compact: !showsPlayingLabel }"
            :title="t('library.row.playing')"
          >
            <AppIcon name="play" :label="showsPlayingLabel ? '' : t('library.row.playing')" />
            <template v-if="showsPlayingLabel">{{ t('library.row.playing') }}</template>
          </span>
          <span v-if="track.missing" class="library_row_badge">
            <AppIcon name="warning" />
            {{ t('library.row.missing') }}
          </span>
        </span>
      </template>
      <span v-else-if="column.key === 'duration'" class="library_row_duration">
        {{ valueFor(column) }}
      </span>
      <span v-else class="library_row_text" :title="valueFor(column)">
        {{ valueFor(column) }}
      </span>
    </span>
    <span class="library_row_cell library_row_actions" role="cell">
      <LibraryRowActions
        ref="actions"
        :track="track"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
        @verify="emit('verify', $event)"
      />
    </span>
  </div>
</template>

<style scoped lang="scss">
.library_row {
  display: grid;
  grid-template-columns: var(--library_grid_columns);
  gap: $space_sm;
  align-items: center;
  height: var(--library_row_height);
  padding: 0 $space_md;
  border-bottom: 1px solid var(--color_border);
  cursor: pointer;
  transition: background-color $duration_fast ease;

  &:hover {
    background-color: var(--row_hover_background);
  }

  @include focus_ring;

  &_selected {
    background-color: var(--row_selected_background);
  }

  &_missing {
    color: var(--color_text_muted);
  }

  &_playing {
    box-shadow: inset 3px 0 0 var(--color_accent);
    background-color: var(--row_selected_background);
  }

  &_playing[style*='--cover_row_gradient'] {
    background: var(--cover_row_gradient), var(--color_surface);
  }

  &_cell {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // The cover is the one cell measured in both directions: it fills its column and the
  // row was made tall enough to hold it.
  &_cover {
    display: flex;
    align-items: center;
    height: calc(var(--library_row_height) - #{$space_sm});
  }

  &_title {
    display: flex;
    gap: $space_sm;
    align-items: center;
    min-width: 0;
  }

  &_text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &_badge {
    display: inline-flex;
    gap: $space_2xs;
    align-items: center;
    flex-shrink: 0;
    padding: 0 $space_sm;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_sm;
    font-size: 0.75em;

    &_playing {
      border-color: var(--color_accent);
      color: var(--color_accent);
    }

    // Only the symbol is left: a round chip rather than a squashed label.
    &_compact {
      justify-content: center;
      width: 1.5rem;
      padding: 0;
      border-radius: 999px;
    }
  }

  &_duration {
    font-variant-numeric: tabular-nums;
  }

  // The cell paints nothing: the menu sits straight on the row. A background of its own
  // could never match, because the gradient of a playing row is spread over the whole
  // width and would restart inside these few rem as a brighter patch.
  &_actions {
    display: flex;
    gap: $space_xs;
    grid-column: -1;
    position: sticky;
    right: 0;
    z-index: 1;
    width: 2.5rem;
    justify-self: end;
    justify-content: center;
    background: none;
    overflow: visible;
  }
}
</style>
