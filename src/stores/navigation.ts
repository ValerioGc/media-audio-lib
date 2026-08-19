import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

/**
 * Which top level view is on screen.
 *
 * The app has a handful of flat views and no addressable URLs, so a router would only add
 * machinery: a single piece of state is enough to switch between them.
 */
export const APP_VIEWS = ['library', 'settings'] as const;
export type AppView = (typeof APP_VIEWS)[number];

export const useNavigationStore = defineStore('navigation', () => {
  const view = ref<AppView>('library');

  const isLibrary = computed(() => view.value === 'library');
  const isSettings = computed(() => view.value === 'settings');

  function go(next: AppView) {
    view.value = next;
  }

  /** Opens the settings, or returns to the library when they are already open. */
  function toggleSettings() {
    view.value = view.value === 'settings' ? 'library' : 'settings';
  }

  return { view, isLibrary, isSettings, go, toggleSettings };
});
