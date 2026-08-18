import js from '@eslint/js';
import prettier from '@vue/eslint-config-prettier';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,vue}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['dist/**', 'coverage/**', 'src-tauri/**', 'node_modules/**'],
  },

  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  prettier,

  {
    name: 'app/rules',
    rules: {
      // Aligned with the SonarQube quality gate.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      complexity: ['error', 15],
      'max-depth': ['error', 4],
      'max-params': ['error', 5],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        // ignoreRestSiblings allows omitting a property via `const { a: _a, ...rest } = obj`.
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'vue/multi-word-component-names': ['error', { ignores: ['App'] }],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/define-macros-order': 'error',
      'vue/no-unused-refs': 'error',
    },
  },

  {
    name: 'app/tests',
    files: ['**/*.spec.ts'],
    rules: {
      'max-params': 'off',
    },
  },
);
