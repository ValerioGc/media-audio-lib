import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/library' },
  { path: '/library', name: 'library', component: () => import('@/views/LibraryView.vue') },
  { path: '/player', name: 'player', component: () => import('@/views/PlayerView.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
