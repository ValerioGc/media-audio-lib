/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const DEV_SERVER_PORT = 1420;

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        // Tokens and mixins are available in every <style lang="scss"> block
        // without repeating @use in each component.
        loadPaths: [fileURLToPath(new URL('./src/assets/styles', import.meta.url))],
        additionalData: '@use "shared" as *;\n',
      },
    },
  },

  // Required by Tauri: keep the CLI log readable and expose TAURI_ env vars.
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],

  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },

  build: {
    target: 'esnext',
    sourcemap: true,
  },

  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/main.ts', 'src/**/*.spec.ts', 'src/**/*.d.ts', 'src/types/**'],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        functions: 80,
        statements: 80,
        lines: 80,
        branches: 75,
      },
    },
  },
});
