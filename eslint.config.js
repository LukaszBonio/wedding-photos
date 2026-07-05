import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,vue}'],
  },
  {
    name: 'app/ignores',
    // gas/ targets the Apps Script runtime (no ES modules, different globals),
    // so it is linted separately from the frontend, not by this config.
    ignores: ['dist/**', 'dev-dist/**', 'coverage/**', 'node_modules/**', 'gas/**'],
  },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  {
    name: 'app/rules',
    rules: {
      // Hard project rule: `any` is forbidden. Model boundaries with Zod instead.
      '@typescript-eslint/no-explicit-any': 'error',
      // Pairs with verbatimModuleSyntax: keep type-only imports explicit.
      '@typescript-eslint/consistent-type-imports': 'error',
      // Disabled with justification: the root component is named `App`, and view
      // components already use multi-word names (HomeView, PreviewView, ...),
      // so enforcing this rule only produces a false positive on App.vue.
      'vue/multi-word-component-names': 'off',
    },
  },
  skipFormatting,
);
