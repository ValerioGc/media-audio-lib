import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

/**
 * Which top level view is on screen.
 *
 * The app has a handful of flat views and no addressable URLs, so a router would only add
 * machinery: a single piece of state is enough to switch between them.
 */
export const APP_VIEWS = ['library', 'settings', 'help', 'player'] as const;
export type AppView = (typeof APP_VIEWS)[number];

export const useNavigationStore = defineStore('navigation', () => {
  const view = ref<AppView>('library');

  const isLibrary = computed(() => view.value === 'library');
  const isSettings = computed(() => view.value === 'settings');
  const isHelp = computed(() => view.value === 'help');
  const isPlayer = computed(() => view.value === 'player');

  function go(next: AppView) {
    view.value = next;
  }

  /** Opens a view, or returns to the library when that view is already open. */
  function toggle(target: AppView) {
    view.value = view.value === target ? 'library' : target;
  }

  function toggleSettings() {
    toggle('settings');
  }

  function toggleHelp() {
    toggle('help');
  }

  return { view, isLibrary, isSettings, isHelp, isPlayer, go, toggle, toggleSettings, toggleHelp };
});
