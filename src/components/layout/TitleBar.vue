<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/AppTooltip.vue';
import { APP_NAME } from '@/config/app-config';
import type { IconName } from '@/config/icons';
import { closeWindow, minimizeWindow, toggleMaximizeWindow } from '@/services/window-controls';
import { useNavigationStore } from '@/stores/navigation';

const { t } = useI18n();
const navigation = useNavigationStore();

interface WindowControl {
  id: string;
  icon: IconName;
  label: string;
  action: () => void;
}

const controls = computed<WindowControl[]>(() => [
  {
    id: 'minimize',
    icon: 'minimize',
    label: t('titlebar.minimize'),
    action: () => void minimizeWindow(),
  },
  {
    id: 'maximize',
    icon: 'maximize',
    label: t('titlebar.maximize'),
    action: () => void toggleMaximizeWindow(),
  },
  {
    id: 'close',
    icon: 'close',
    label: t('titlebar.close'),
    action: () => void closeWindow(),
  },
]);
</script>

<template>
  <header class="titlebar">
    <!-- Only this area drags the window: the buttons must stay clickable. -->
    <div class="titlebar_drag" data-tauri-drag-region @dblclick="toggleMaximizeWindow()">
      <AppIcon class="titlebar_mark" name="note" />
      <span class="titlebar_name">{{ APP_NAME }}</span>
    </div>

    <div class="titlebar_actions">
      <AppTooltip :text="t('nav.help')" placement="bottom" align="center">
        <button
          class="titlebar_action"
          :class="{ titlebar_action_active: navigation.isHelp }"
          type="button"
          :aria-label="t('nav.help')"
          :aria-current="navigation.isHelp ? 'page' : undefined"
          data-testid="open-help"
          @click="navigation.toggleHelp()"
        >
          <AppIcon name="help" />
        </button>
      </AppTooltip>

      <AppTooltip :text="t('nav.settings')" placement="bottom" align="center">
        <button
          class="titlebar_action"
          :class="{ titlebar_action_active: navigation.isSettings }"
          type="button"
          :aria-label="t('nav.settings')"
          :aria-current="navigation.isSettings ? 'page' : undefined"
          data-testid="open-settings"
          @click="navigation.toggleSettings()"
        >
          <AppIcon name="settings" />
        </button>
      </AppTooltip>
    </div>

    <div class="titlebar_controls">
      <AppTooltip
        v-for="control in controls"
        :key="control.id"
        :text="control.label"
        placement="bottom"
        align="center"
      >
        <button
          class="titlebar_button"
          :class="`titlebar_button_${control.id}`"
          type="button"
          :aria-label="control.label"
          :data-testid="`window-${control.id}`"
          @click="control.action"
        >
          <AppIcon :name="control.icon" />
        </button>
      </AppTooltip>
    </div>
  </header>
</template>

<style scoped lang="scss">
.titlebar {
  display: flex;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  gap: $space_sm;
  align-items: stretch;
  height: $titlebar_height;

  // The bar melts into the page: no surface of its own and no rule under it.
  background-color: transparent;
  user-select: none;

  &_drag {
    display: flex;
    flex: 1;
    gap: $space_sm;
    align-items: center;
    min-width: 0;
    padding: 0 $page_gutter;
  }

  &_mark {
    color: var(--color_accent);
    font-size: 1.05rem;
  }

  &_name {
    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.8125rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_actions {
    display: flex;
    gap: $space_xs;
    align-items: center;
    padding-right: $space_sm;
  }

  &_controls {
    display: flex;
    align-items: stretch;
  }

  &_action,
  &_button {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: none;
    color: var(--color_text_muted);
    font: inherit;
    cursor: pointer;
    transition:
      background-color $duration_fast ease,
      color $duration_fast ease;

    &:hover {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    @include focus_ring;
  }

  // Help and settings are commands of the app, not of the window: they are bigger, they
  // are spaced apart and they sit on their own rounded target.
  &_action {
    width: 2.25rem;
    height: 2.25rem;
    align-self: center;
    border-radius: $radius_md;
    font-size: 1.25rem;

    &_active {
      background-color: var(--color_accent_soft);
      color: var(--color_accent);
    }
  }

  &_button {
    width: 2.75rem;
    height: 100%;

    // Closing is the one destructive control, and it says so on hover.
    &_close:hover {
      background-color: #c42b1c;
      color: #ffffff;
    }
  }
}
</style>
