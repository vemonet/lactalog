import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import solid from 'eslint-plugin-solid/configs/typescript';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  globalIgnores(['dist/**', 'dev-dist/**', 'node_modules/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    ...solid,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
  },
  // Node context for config files.
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Service-worker scripts served from public/.
  {
    files: ['public/*.js'],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.browser } },
  }
);
