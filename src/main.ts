import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import { i18n } from './i18n';
import MiniPlayerView from './views/MiniPlayerView.vue';
import MiniConfirmView from './views/MiniConfirmView.vue';
import './assets/styles/main.scss';

// The floating dock is a window of its own, opened on the same bundle: which one to draw is
// read from the address it was opened with.
const view = new URLSearchParams(globalThis.location.search).get('view');
const rootView = view === 'mini-confirm' ? MiniConfirmView : view === 'mini' ? MiniPlayerView : App;

createApp(rootView).use(createPinia()).use(i18n).mount('#app');
