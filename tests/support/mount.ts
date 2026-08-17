import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';

import { i18n } from '@/i18n';
import { routes } from '@/router';
import { DEFAULT_SETTINGS } from '@/types/settings';

export function createTestPinia(): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

export function createTestRouter(): Router {
  return createRouter({ history: createMemoryHistory(), routes });
}

/** Restores the shared i18n instance between tests. */
export function resetI18n() {
  i18n.global.locale.value = DEFAULT_SETTINGS.locale;
}

export function withPinia() {
  return { global: { plugins: [createTestPinia(), i18n] } };
}
